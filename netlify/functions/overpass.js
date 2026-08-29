const https = require('https');

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    // Leemos lat, lng y radio desde los parámetros de la URL (GET)
    let lat = event.queryStringParameters?.lat;
    let lng = event.queryStringParameters?.lng;
    let radio = event.queryStringParameters?.radio || 5000;

    // Si también llegaran por POST, intentamos rescatarlos
    if ((!lat || !lng) && event.httpMethod === 'POST' && event.body) {
        try {
            const bodyData = JSON.parse(event.body);
            lat = bodyData.lat;
            lng = bodyData.lng;
            radio = bodyData.radio || radio;
        } catch (e) {}
    }

    if (!lat || !lng) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Faltan los parámetros lat y lng' })
        };
    }

    // Construimos la consulta Overpass QL automáticamente usando la ubicación del usuario
    const query = `
        [out:json][timeout:25];
        (
          node(around:${radio},${lat},${lng})[amenity=recycling];
          way(around:${radio},${lat},${lng})[amenity=recycling];
          relation(around:${radio},${lat},${lng})[amenity=recycling];
          node(around:${radio},${lat},${lng})[recycling];
          way(around:${radio},${lat},${lng})[recycling];
          relation(around:${radio},${lat},${lng})[recycling];
        );
        out body;
        >;
        out skel qt;
    `;

    return new Promise((resolve, reject) => {
        const data = 'data=' + encodeURIComponent(query);
        
        const options = {
            hostname: 'overpass-api.de',
            port: 443,
            path: '/api/interpreter',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': data.length,
                'User-Agent': 'EcoCicloApp/1.0'
            }
        };

        const req = https.request(options, (res) => {
            let responseBody = '';

            res.on('data', (chunk) => {
                responseBody += chunk;
            });

            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Content-Type': 'application/json'
                    },
                    body: responseBody
                });
            });
        });

        req.on('error', (error) => {
            resolve({
                statusCode: 500,
                body: JSON.stringify({ error: error.message })
            });
        });

        req.write(data);
        req.end();
    });
};
