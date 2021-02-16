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
        for (const state of data.gamestates.reverse()){
            const name = state.player_count?`${state.name}\n(${pluralize('player', state.player_count, true)})`:state.name;
            g.addNode(state.name, {label:name, render: render, data:state});

            transitions[state.name] = {};

            for (const transition of state.transitions){
                const toState = _.findWhere(data.gamestates, {id: transition.to_state_id});

                if (!_.has(transitions[state.name], toState.name)){
                    transitions[state.name][toState.name] = [];
                }
                const group_name = transition.group_name ? transition.group_name : null;
                if (group_name){
                    transitions[state.name][toState.name].push(group_name);
                }
            }
            for (const code of state.codes){
                for(const action of code.actions){
                    if (action.type === 'transition'){

                        const toState = _.findWhere(data.gamestates, {id: action.to_state_id});
                        if (!_.has(transitions[state.name], toState.name)){
                            transitions[state.name][toState.name] = [];
                        }
                        transitions[state.name][toState.name].push(code.code);
                    }
                }
            }
        }

        for (const trigger of data.triggers){
            let addNode = false;
            for(const action of trigger.actions){
                if (action.type === 'transition'){
                    const toState = _.findWhere(data.gamestates, {id: action.to_state_id});
                    if (!_.has(transitions, `trigger-${trigger.name}`)){
                        transitions[`trigger-${trigger.name}`] = {};
                    }
                    if (!_.has(transitions[`trigger-${trigger.name}`], toState.name)){
                        transitions[`trigger-${trigger.name}`][toState.name] = [];
                    }
                    transitions[`trigger-${trigger.name}`][toState.name].push('Trigger');
                    addNode = true;
                }
            }
            if (addNode){
                trigger.type = 'trigger';
                g.addNode(`trigger-${trigger.name}`, {label:`Trigger: ${trigger.name}`, render: render, data:trigger});
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
