const https = require('https');

exports.handler = async function(event, context) {
    // Solo permitimos peticiones POST (o puedes cambiarlo si prefieres GET)
    if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    // Obtenemos la consulta (query) de Overpass que manda tu app
    // Si mandas la query por POST (en el body), la leemos de ahí; si no, usamos una por defecto o la leemos de los parámetros
    let query = '';
    if (event.httpMethod === 'POST' && event.body) {
        try {
            const bodyData = JSON.parse(event.body);
            query = bodyData.query;
        } catch (e) {
            query = event.body; // por si viene como texto plano
        }
    } else {
        query = event.queryStringParameters?.query;
    }

    if (!query) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Falta el parámetro query de Overpass' })
        };
    }

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
                        'Access-Control-Allow-Origin': '*', // Permite que tu app hable con la función
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