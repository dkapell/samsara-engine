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
        const gamestates = await response.json();

        const g = new Dracula.Graph();

        const render = function(r, n){
            let borderColor = '#375a7f';
            if (n.data.start){
                borderColor = '#00bc8c';
            } else if (n.data.special){
                borderColor = '#3498db';
            } else if (n.data.finish){
                borderColor = '#e74c3c';
            }
            const label = r.text(0,0, n.label);
            label.attr({'font-size':'13px'});
            label.attr({'opacity':0});
            let ovalWidth = label.getBBox().width + 40;

            if (ovalWidth < 60 ){ ovalWidth = 60; }
            let ovalHeight = ovalWidth * 0.6;
            if (ovalHeight > 60) { ovalHeight = 60; }
            const set = r.set()
                .push(r.ellipse(0, 0, ovalWidth/2, ovalHeight/2).attr({ fill: '#fff', 'stroke-width': 2, stroke: borderColor }))
                .push(r.text(0, 0, n.label).attr({'font-size':'13px'}));
            return set;
        };

        const transitions = {};

        for (const state of gamestates.reverse()){
            const name = state.player_count?`${state.name}\n(${pluralize('player', state.player_count, true)})`:state.name;
            g.addNode(state.name, {label:name, render: render, data:state});

            transitions[state.name] = {};

            for (const transition of state.transitions){
                const toState = _.findWhere(gamestates, {id: transition.to_state_id});

                if (!_.has(transitions[state.name], toState.name)){
                    transitions[state.name][toState.name] = [];
                }
                const group_name = transition.group_name ? transition.group_name : 'All';
                transitions[state.name][toState.name].push(group_name);
            }
        }

        for (const fromStateName in transitions){
            for (const toStateName in transitions[fromStateName]){
                const options = {
                    style: {
                        label: transitions[fromStateName][toStateName].join(', '),
                        'label-style': {
                            'font-size': '12px'
                        },
                        directed: true
                    }
                };
                g.addEdge(fromStateName, toStateName, options);
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
