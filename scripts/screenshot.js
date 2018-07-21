module.exports = {
        image: async(shop) => {
                const webshot = require('webshot');
                const jimp = require('jimp');

                let options = {
                    screenSize: {
                        width: 375,
                        height: 667
                    },
                    shotSize: {
                        width: 'all',
                        height: 667
                    },
                    userAgent: 'Mozilla/5.0 (iPhone; U; CPU iPhone OS 3_2 like Mac OS X; en-us)' +
                        ' AppleWebKit/531.21.20 (KHTML, like Gecko) Mobile/7B298g'
                };
                let success = await payload();

                function payload() {
                    return new Promise(function(resolve, reject) {
                        try {
                            webshot(shop, 'public/images/screenshot_x.png', options, function(err) {
                                if (err) throw err;
                                jimp.read('public/images/screenshot_x.png', function(err, image) {
                                    if (err) throw err;
                                    image.resize(375, 667)
                                        .write('public/images/screenshot_x.png');
                                    //console.log(shop + ' screenshot created successfully!');
                                    resolve(true);
                                });
                            });
                        } catch (err) {
                            if (err.message) console.log(err.message)
                            reject(false);
                        }
                    });
                } //END Payload
                return success;
            } //END Image
    } //END Module