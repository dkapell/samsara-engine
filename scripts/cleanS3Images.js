const _ = require('underscore');
const models = require('../lib/models');
const imageManager = require('../lib/imageManager');

const safeID = 200;

(async function main() {

    const files = await imageManager.list();
    for (const file of files){
        const id = Number((file.Key.split(/\//))[1]);
        if (id < safeID){ continue; }
        const image = await models.image.get(id);
        if (image){ continue; }
        console.log(`removing orphaned image: ${file.Key}`);
        await imageManager.remove(file.Key);
    }

    console.log('done');
    process.exit(0);
})().catch((error) => {
    process.exitCode = 1;
    console.trace(error);
});
