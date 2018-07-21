let html = async(shop, theme_id, getRequestHeaders, postRequestHeaders) => {
    const request = require('request-promise');
    const fs = require('fs');
    const path = require('path');
    const messenger = require('./createAssets.js');
    let theme_liquid = 'layout/theme.liquid';
    let themeLiquid = 'https://' + shop + '/admin/themes/' + theme_id +
        '/assets.json?asset[key]=' + theme_liquid + '&theme_id=' + theme_id;
    let themeResponse, productsResponse, pageResponse, productJSON, pageJSON, blogJSON;
    let scriptsAdded = false;

    try {
        themeResponse = JSON.parse(await request.get(themeLiquid, { headers: getRequestHeaders }));
        let secLiquid = themeResponse.asset.value;
        let temp1, temp2, temp3, temp4, temp5, finalLiquid, productScript, pageScript;
        if (secLiquid) {

            //Load Mutation Observers et al
            temp1 = secLiquid.substring(0, secLiquid.indexOf('<head>') + 6);
            temp2 = fs.readFileSync(path.resolve(__dirname, '../snippets/headScript.html')).toString();
            temp3 = secLiquid.substring(secLiquid.indexOf('<head>') + 6, secLiquid.lastIndexOf('</body>'));
            //Load JSON for theme
            temp4 = fs.readFileSync(path.resolve(__dirname, '../snippets/theme-json-ld.html')).toString();
            temp5 = secLiquid.substring(secLiquid.lastIndexOf('</body>'), secLiquid.length);

            finalLiquid = temp1 + "{% include 'dropthemizer-mutation-script' %}" + temp3 + "{% include 'dropthemizer-themeJSON' %}" + temp5;

            await messenger.createAssets(shop, 'snippets/dropthemizer-mutation-script.liquid', temp2, postRequestHeaders, theme_id);
            await messenger.createAssets(shop, 'snippets/dropthemizer-themeJSON.liquid', temp4, postRequestHeaders, theme_id);

            await messenger.createAssets(shop, 'layout/theme-backup.liquid', secLiquid, postRequestHeaders, theme_id);
            await messenger.createAssets(shop, 'layout/theme.liquid', finalLiquid, postRequestHeaders, theme_id);



            //Work On Products/Pages
            let productLiquid = 'https://' + shop + '/admin/themes/' + theme_id + '/assets.json?asset[key]=templates/product.liquid&theme_id=' + theme_id;
            let pageLiquid = 'https://' + shop + '/admin/themes/' + theme_id + '/assets.json?asset[key]=templates/page.liquid&theme_id=' + theme_id;
            let blogLiquid = 'https://' + shop + '/admin/themes/' + theme_id + '/assets.json?asset[key]=templates/blog.liquid&theme_id=' + theme_id;

            productsResponse = JSON.parse(await request.get(productLiquid, { headers: getRequestHeaders }));
            pageResponse = JSON.parse(await request.get(pageLiquid, { headers: getRequestHeaders }));
            blogResponse = JSON.parse(await request.get(blogLiquid, { headers: getRequestHeaders }));

            //Load JSON-LD Scripts for products/pages
            productScript = fs.readFileSync(path.resolve(__dirname, '../snippets/products-json-ld.html')).toString();
            pageScript = fs.readFileSync(path.resolve(__dirname, '../snippets/page-json-ld.html')).toString();
            blogScript = fs.readFileSync(path.resolve(__dirname, '../snippets/blog-json-ld.html')).toString();

            //create backups
            await messenger.createAssets(shop, 'templates/product-bkp.liquid', productScript, postRequestHeaders, theme_id);
            await messenger.createAssets(shop, 'templates/page-bkp.liquid', pageScript, postRequestHeaders, theme_id);

            productJSON = productsResponse.asset.value + "\n" + "{% include 'dropthemizer-productsJSON' %}";
            pageJSON = pageResponse.asset.value + "\n" + "{% include 'dropthemizer-pageJSON' %}";
            blogJSON = blogResponse.asset.value + "\n" + "{% include 'dropthemizer-blogJSON' %}";

            //Create JSON-LD Assets for Products/pages
            await messenger.createAssets(shop, 'snippets/dropthemizer-productsJSON.liquid', productScript, postRequestHeaders, theme_id);
            await messenger.createAssets(shop, 'snippets/dropthemizer-pageJSON.liquid', pageScript, postRequestHeaders, theme_id);
            await messenger.createAssets(shop, 'snippets/dropthemizer-blogJSON.liquid', blogScript, postRequestHeaders, theme_id);

            await messenger.createAssets(shop, 'templates/product.liquid', productJSON, postRequestHeaders, theme_id);
            await messenger.createAssets(shop, 'templates/page.liquid', pageJSON, postRequestHeaders, theme_id);
            await messenger.createAssets(shop, 'templates/blog.liquid', blogJSON, postRequestHeaders, theme_id);


            //create dropthemizer-worker
            let worker_fetch = fs.readFileSync(path.resolve(__dirname, '../scripts/dropthemizer-worker.js')).toString();
            await messenger.createAssets(shop, 'assets/dropthemizer-worker.js', worker_fetch, postRequestHeaders, theme_id);

            scriptsAdded = true;
        }
    } catch (error) {
        if (error.message) throw new Error(error.message);
        throw new Error('Could not create assets to support theme.liquid OR could not write to theme.liquid');
    }
    return scriptsAdded;
}

exports.html = html;