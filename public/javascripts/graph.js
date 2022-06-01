/* global _ */
var Dracula = require('graphdracula');
var pluralize = require('pluralize');
$(function(){
    renderGraph();
});


async function renderGraph(){
    try{
        const response = await fetch('/game/graph/data');
        if(!response.ok){
            throw new Error ('Got a bad response');
        }
        const data = await response.json();


        const g = new Dracula.Graph();

        const render = function(r, n){
            let borderColor = '#375a7f';
            if (n.data.type === 'trigger'){
                borderColor = '#f39c12';
            } else if (n.data.start){
                borderColor = '#00bc8c';
            } else if (n.data.special){
                borderColor = '#3498db';
            } else if (n.data.finish){
                borderColor = '#e74c3c';
            }
            const label = r.text(0,0, n.label);
            label.attr({'font-size':'11px'});
            label.attr({'opacity':0});
            let ovalWidth = label.getBBox().width + 30;

            if (ovalWidth < 40 ){ ovalWidth = 40; }
            let ovalHeight = ovalWidth * 0.6;
            if (ovalHeight > 40) { ovalHeight = 40; }
            const set = r.set()
                .push(r.ellipse(0, 0, ovalWidth/2, ovalHeight/2).attr({ fill: '#fff', 'stroke-width': 2, stroke: borderColor }))
                .push(r.text(0, 0, n.label).attr({'font-size':'11px'}));
            return set;
        };

        const transitions = {};
        for (const screen of data.screens.reverse()){
            const name = screen.player_count?`${screen.name}\n(${pluralize('player', screen.player_count, true)})`:screen.name;
            g.addNode(screen.name, {label:name, render: render, data:screen});

            transitions[screen.name] = {};

            for (const transition of screen.transitions){
                const toScreen = _.findWhere(data.screens, {id: transition.to_screen_id});

                if (!_.has(transitions[screen.name], toScreen.name)){
                    transitions[screen.name][toScreen.name] = [];
                }
                const group_name = transition.group_name ? transition.group_name : null;
                if (group_name){
                    transitions[screen.name][toScreen.name].push(group_name);
                }
            }
            for (const code of screen.codes){
                for(const action of code.actions){
                    if (action.type === 'transition'){

                        const toScreen = _.findWhere(data.screens, {id: action.to_screen_id});
                        if (!_.has(transitions[screen.name], toScreen.name)){
                            transitions[screen.name][toScreen.name] = [];
                        }
                        transitions[screen.name][toScreen.name].push(code.code);
                    }
                }
            }
        }

        for (const trigger of data.triggers){
            let addNode = false;
            for(const action of trigger.actions){
                if (action.type === 'transition'){
                    const toScreen = _.findWhere(data.screens, {id: action.to_screen_id});
                    if (!_.has(transitions, `trigger-${trigger.name}`)){
                        transitions[`trigger-${trigger.name}`] = {};
                    }
                    if (!_.has(transitions[`trigger-${trigger.name}`], toScreen.name)){
                        transitions[`trigger-${trigger.name}`][toScreen.name] = [];
                    }
                    transitions[`trigger-${trigger.name}`][toScreen.name].push('Trigger');
                    addNode = true;
                }
            }
            if (addNode){
                trigger.type = 'trigger';
                g.addNode(`trigger-${trigger.name}`, {label:`Trigger: ${trigger.name}`, render: render, data:trigger});
            }

        }

        for (const fromScreenName in transitions){
            for (const toScreenName in transitions[fromScreenName]){
                const options = {
                    style: {
                        label: transitions[fromScreenName][toScreenName].join(', '),
                        'label-style': {
                            'font-size': '12px'
                        },
                        directed: true
                    }
                };
                g.addEdge(fromScreenName, toScreenName, options);
            }
        }

        const layouter = new Dracula.Layout.Spring(g);
        layouter.layout();

        const h = $('#graphContainer').height();
        const w = $('#graphContainer').width();
        const renderer = new Dracula.Renderer.Raphael('#graphContainer', g, w, h);
        renderer.draw();



    } catch (e){
        console.trace(e);
    }
}
