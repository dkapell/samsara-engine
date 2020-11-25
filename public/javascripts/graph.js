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

        const transitions = {};

        for (const state of gamestates.reverse()){
            const name = state.player_count?`${state.name} (${pluralize('player', state.player_count, true)})`:state.name;
            g.addNode(state.name, {label:name});
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
                        directed: true
                    }
                };
                g.addEdge(fromStateName, toStateName, options);
            }
        }


        const layouter = new Dracula.Layout.Spring(g);
        layouter.layout();

        const h = $('#graphContainer').height(); //get the container height into variable h
        const w = $('#graphContainer').width();
        const renderer = new Dracula.Renderer.Raphael('#graphContainer', g, w, h);
        renderer.draw();



    } catch (e){
        console.trace(e);
    }
}
