start();

async function start() {
    const dotenv = require('dotenv').config();
    const ejs = require('ejs');
    const express = require('express');
    const app = express();
    const crypto = require('crypto');
    const cookie = require('cookie');
    const nonce = require('nonce')();
    const querystring = require('querystring');
    const bodyParser = require('body-parser');
    const cors = require('cors');
    const fs = require('fs');
    const chargeMerchant = require('./scripts/createCharge.js');
    const gapi = require('./scripts/gCompute.js');
    const dash = require('./scripts/loadDash.js');
    const token = require('./scripts/accessToken.js');
    const onflyOptimize = require('./scripts/onflyOptimize.js');
    const processImages = require('./scripts/processImages.js');
    const screenshot = require('./scripts/screenshot.js');
    const path = require('path');
    let pollData = { screenshot: false, fullyOptimized: false };


    let postRequestHeaders, getRequestHeaders, globalFormValues;

    const apiKey = process.env.SHOPIFY_API_KEY;
    const apiSecret = process.env.SHOPIFY_API_SECRET;
    const scopes = ['read_themes', 'write_themes', 'read_products', 'write_products'];
    const APP_URL = "https://acf95df7.ngrok.io"; // Replace this with your HTTPS Forwarding address

    //Set up app view engine/static paths
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '/views'))
    app.use(express.static(path.join(__dirname, '/public')));
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(cors());

    app.get('/', (req, res) => {
        const shop = req.query.shop;
        if (shop) {
            const state = nonce();
            const redirectUri = APP_URL + '/authenticate';
            const installUrl = 'https://' + shop +
                '/admin/oauth/authorize?client_id=' + apiKey +
                '&scope=' + scopes +
                '&state=' + state +
                '&redirect_uri=' + redirectUri;

            res.cookie('state', state);
            res.redirect(installUrl);
        } else {
            return res.status(400).send('400 Error - Missing shop parameter');
        }
    });

    app.get('/authenticate', async(req, res) => {
        const { shop, hmac, code, state } = req.query;
        const stateCookie = cookie.parse(req.headers.cookie).state;

        if (state !== stateCookie) {
            return res.status(403).send('Request origin cannot be verified');
        }

        if (shop && hmac && code) {
            // DONE: Validate request is from Shopify
            const map = Object.assign({}, req.query);
            delete map.signature;
            delete map.hmac;
            const message = querystring.stringify(map);
            const providedHmac = Buffer.from(hmac, 'utf-8');
            const generatedHash = Buffer.from(
                crypto
                .createHmac('sha256', apiSecret)
                .update(message)
                .digest('hex'),
                'utf-8'
            );
            let hashEquals = false;

            try {
                hashEquals = crypto.timingSafeEqual(generatedHash, providedHmac)
            } catch (e) {
                hashEquals = false;
            };

            if (!hashEquals) {
                return res.status(400).send('HMAC validation failed');
            }

            // Request Access Token
            const accessToken = await token.getAccessToken(shop, apiKey, apiSecret, code);
            getRequestHeaders = {
                'X-Shopify-Access-Token': accessToken,
            };
            postRequestHeaders = {
                "Content-Type": "application/json",
                'X-Shopify-Access-Token': accessToken,
            };


            //Render Dropthemizer Homepage

            async function renderDash(res) {
                //Call Google API for Page Speed Insights
                res.render('dashboard');
                let gData = await gapi.getGoogleData(shop);
                let dashboardData = await dash.loadDash(shop, getRequestHeaders, gData);
                pollData.dashReady = true;
                pollData.dashboardData = dashboardData;
                pollData.screenshot = await screenshot.image(shop);
            }

            renderDash(res);

            app.get('/dashboard', (req, res) => {
                renderDash(res);
            });

            app.post('/shopify/charge', async(req, res) => {
                let charge;
                globalFormValues = req.body;
                charge = await chargeMerchant.bill(shop, postRequestHeaders);
                res.redirect(charge.confirmation_url);
            });

            app.get('/shopify/charge/handler/', async(req, res) => {
                let charge_id, isAccepted;
                if (req.query) {
                    charge_id = req.query.charge_id;
                    isAccepted = await chargeMerchant.isAccepted(shop, charge_id, getRequestHeaders);

                    if (isAccepted.application_charge.status == 'accepted') {
                        pollData.paymentAccepted = true;
                        res.redirect('/dropthemize');
                        chargeMerchant.activate(shop, isAccepted, postRequestHeaders);

                    } else {
                        res.sendFile('404.html', { root: path.join(__dirname, 'public/pages/') });
                    }

                } else {
                    res.sendFile('404.html', { root: path.join(__dirname, 'public/pages/') });
                }
            });

            //Beginning of DROPTHEMIZER PAYLOAD - Executes the store optimization
            app.get('/dropthemize', async(req, res) => {
                pollData.paymentAccepted = true;
                res.redirect('/dashboard');
                if (globalFormValues) {
                    var sameAs = [];
                    var originalContent;
                    if (globalFormValues.facebook && globalFormValues.facebook != '') {
                        sameAs.push('"https://www.facebook.com/' + globalFormValues.facebook + '"');
                    }
                    if (globalFormValues.instagram && globalFormValues.instagram != '') {
                        sameAs.push('"https://instagram.com/' + globalFormValues.instagram + '"');
                    }
                    if (globalFormValues.twitter && globalFormValues.twitter != '') {
                        sameAs.push('"https://twitter.com/' + globalFormValues.twitter + '"');
                    }
                    if (globalFormValues.pinterest && globalFormValues.pinterest != '') {
                        sameAs.push('"https://www.pinterest.com/' + globalFormValues.pinterest + '"');
                    }
                    if (globalFormValues.gplus && globalFormValues.gplus != '') {
                        sameAs.push('"https://plus.google.com/' + globalFormValues.gplus + '"');
                    }
                    if (sameAs.length > 1 || globalFormValues.storelogo) {
                        var theme_json;
                        theme_json = fs.readFileSync('snippets/theme-json-ld.html').toString();
                        originalContent = theme_json;
                        if (sameAs.length > 1)
                            theme_json = theme_json.replace('"sameAs": []', '"sameAs": ' + '[' + sameAs + ']');
                        if (globalFormValues.storelogo) {
                            theme_json = theme_json.replace('"logo": "{{ settings.logo | img_url }}"', '"logo": "' + globalFormValues.storelogo + '"');
                            theme_json = theme_json.replace('"image": "{{ settings.logo | img_url }}"', '"image": "' + globalFormValues.storelogo + '"');

                        }
                        fs.writeFileSync('snippets/theme-json-ld.html', theme_json);

                    }
                    var refresh = await dropthemize();
                    if (originalContent && refresh) {
                        fs.writeFileSync('snippets/theme-json-ld.html', originalContent);
                    }
                } else {
                    await dropthemize();
                }

                async function dropthemize() {
                    const dropthemize = require('./scripts/Dropthemize.js');
                    let htmlScripts, processedImages;
                    console.log('Minifying assets for ' + shop);
                    let minified = await dropthemize.minify(shop, getRequestHeaders, postRequestHeaders);
                    if (minified.dropthemized) {
                        console.log('JS/CSS Files minified successfully\n');
                    }
                    //Make theme scripts load async
                    console.log('Uploading files needed for Dropthemizer to ' + shop);
                    htmlScripts = await dropthemize.htmlAsync(shop, minified.theme_id, getRequestHeaders, postRequestHeaders);
                    if (htmlScripts) {
                        console.log('theme.liquid update complete. All Snippets Created Successfully\n');
                    }
                    //Image Optimization
                    console.log('Processing Images for ' + shop + '\n');
                    processedImages = await processImages.run(shop, getRequestHeaders, postRequestHeaders);

                    if (processedImages) {
                        console.log('Product Images Processed Successfully!');
                    }

                    if (htmlScripts && minified.dropthemized && processedImages) {
                        pollData.fullyOptimized = true;
                        console.log('DONE!');
                    }

                    return pollData.fullyOptimized;
                    //End Dropthemize
                }
            });

            app.get('/api/screenshot/', (req, res) => {
                res.status(200).json({ screenshot: pollData.screenshot });
            });

            app.get('/api/optimize/', (req, res) => {
                if (req.query.url) {
                    onflyOptimize.process(req.query.url)
                        .then(data => {
                            var img = Buffer.from(data, 'base64');
                            res.status(200).send(img);
                        })
                        .catch(error => {
                            if (error.message) console.log(error.message);
                            res.status(500).end(req.query.url);
                        });
                } else {
                    res.status(400).end();
                }
            });

            app.get('/api/status/', (req, res) => {
                res.status(200).json({
                    isPayed: pollData.paymentAccepted,
                    optimized: pollData.fullyOptimized,
                    dashReady: pollData.dashReady,
                    dashboardData: pollData.dashboardData
                });
            });
        } else { // Either Hmac|Shop|Code Parameters were missing during authentication
            res.status(400).send('Required parameters missing');
        }
    });

    let port = process.env.PORT || 8080;

    app.listen(port, () => {
        console.log('Dropthemizer is listening!');
    });
}