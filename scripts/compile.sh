#!/bin/bash

# bundle graphing JS
./node_modules/browserify/bin/cmd.js public/javascripts/graph.js -o public/javascripts/bundles/graph.js

# build game templates for client side
./node_modules/pug-cli/index.js -c --name-after-file -o public/javascripts/templates views/game/page.pug views/clientPartials/*.pug

