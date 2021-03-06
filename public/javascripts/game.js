/* global _ pageTemplate toastTemplate popupTemplate addMessage handleChat hideChatSidebar showChatSidebar currentLocation lookup liquidjs addChatEvent refreshPlayerList*/
const engine = new liquidjs.Liquid();
let currentGameState = null;
let textTimeout = null;
let ws = null;
const reconnectInterval = 5000;
let reconnectTimeout = null;
let areaTimers = {};
let gamedata = {};

$(function(){
    $('#game-text').hide();
    openWebSocket();

});

function openWebSocket(){
    var HOST = location.origin.replace(/^http/, 'ws');
    ws = new WebSocket(HOST);

    clearTimeout(reconnectTimeout);

    ws.onmessage = async function (event) {
        const data = JSON.parse(event.data);
        switch(data.action){
            case 'show default': await renderDefault(data); break;
            case 'show page': {
                if (_.has(data, 'gamedata')){
                    for (const key in data.gamedata){
                        gamedata[key] = data.gamedata[key];
                    }
                }
                renderPage(data.gamestate);
            }break;
            case 'load':  window.open(data.url, '_blank'); break;
            case 'display':
                if (data.location === 'popup'){
                    showPopup('text', data);
                } else {
                    showText(data);
                }
                break;
            case 'toast': showToast(data); break;
            case 'image': showPopup('image', data); break;
            case 'chat': await handleChat(data); break;
            case 'code error':
                $('#code-entry').addClass('is-invalid');
                if (!data.retry){
                    $('#code-entry').val('');
                }
                $('#code-feedback').text(data.error);
                $('#code-feedback').show();
                break;
            case 'gamedata':
                gamedata = data.gamedata;
                break;
            case 'playerupdate':
                if (typeof refreshPlayerList === 'function'){
                    await refreshPlayerList();
                }
                break;
        }

        if (data.codeAccept){
            $('#code-entry').removeClass('is-invalid');
            $('#code-entry').val('');
        }
    };

    ws.onclose = function(){
        ws = null;
        reconnectTimeout = setTimeout(openWebSocket, 5000);
    };
    ws.onopen = function () {
        const doc = {
            action:'history',
            options: {}
        };
        if ($('#chat-history-limit').val()){
            doc.options.limit = Number($('#chat-history-limit').val());
        }
        ws.send(JSON.stringify(doc));

    };
}

async function renderDefault(data){
    try{
        const response = await fetch('/game');
        if(!response.ok){
            throw new Error ('Got a bad response');
        }
        const content = await response.text();
        $('#game-content').html(content);

        if (data.chatSidebar){
            showChatSidebar(data.chatExpanded);
            if (data.chat){
                $('#chat-gamestate-tab-nav').show();
            } else {
                $('#chat-gamestate-tab-nav').hide();
                if (currentLocation === 'gamestate'){
                    $('#chat-tabs').find('li:visible:first').find('a').tab('show');
                }
            }
            $('.chat-location').change();
        } else {
            hideChatSidebar();
        }

    } catch (err){
        const $err = $('<div>')
            .addClass('alert')
            .addClass('alert-danger')
            .text('Could not connect to game, please try again in a short while.  If this problem persists, please contact the GMs');


        $('#game-content').html($err);
    }
}

async function renderPage(gamestate){
    if (currentGameState !== gamestate.id){
        let initialState = false;
        if (currentGameState === null){
            initialState = true;
        }
        $('#popupModal').modal('hide');
        currentGameState = gamestate.id;
        gamestate.description = await(liquidify(gamestate.description));
        const rendered = pageTemplate({gamestate: gamestate});
        $('#game-content').html(rendered);
        $('#code-feedback').hide();
        $('#code-form').on('submit', submitCodeForm);
        $('#code-entry').on('change keyup copy paste cut', function() {
            if (!this.value) {
                $(this).removeClass('is-invalid');
            }
        });
        prepImageMap();
        if (gamestate.chatSidebar){
            showChatSidebar(gamestate.chatExpanded);
            if (gamestate.chat){
                $('#chat-gamestate-tab-nav').show();
                if (!initialState && _.has(gamestate, 'name')){
                    addChatEvent('gamestate', gamestate.name);
                }
            } else {
                $('#chat-gamestate-tab-nav').hide();
                if (currentLocation === 'gamestate'){
                    $('#chat-tabs').find('li:visible:first').find('a').tab('show');
                }
            }
            $('.chat-location').change();
        } else {
            hideChatSidebar();
        }
    }
}

async function showToast(data){
    data.message = await liquidify(data.message);
    const toast = toastTemplate(data);
    $('#toastHolder').append(toast);
    const options = {
        autohide: false
    };
    if (data.duration){
        options.autohide = true;
        options.delay = data.duration;
    }
    $(`#toast-${data.id}`).toast(options);
    $(`#toast-${data.id}`).toast('show');
}

async function showText(data){
    $('#game-text').html(await liquidify(data.content));
    $('#game-text').show();
    clearTimeout(textTimeout);
    if (Number(data.duration)){
        textTimeout = setTimeout(hideText, data.duration * 1000);
    }
}

async function showPopup(type, data){
    data.content = await liquidify(data.content);
    const $modal = $('#popupModal');
    $modal.find('.modal-title').text(data.name);
    $modal.find('.modal-body').html(popupTemplate(data));
    $modal.modal('show');
}

function prepImageMap(){
    if (!document.hidden){
        $('img[usemap]').rwdImageMaps();
        $('.map').maphilight({
            wrapClass:true,
            shadow:true,
            strokeWidth:3,
            strokeColor: '3498db',
            fillColor: '000000',
            fillOpacity: 0.2,
        });
        $('.imageHolder').on('click', showAreas);
        $('area').on('click', clickArea);
        $('area').on('mouseover', showAreaName);
        $('area').on('mouseout', clearAreaName);
        return;
    } else {
        setTimeout(prepImageMap, 150);
    }
}

function submitCodeForm(e){
    e.preventDefault();
    $('#code-feedback').hide();
    const code = $('#code-entry').val();
    ws.send(JSON.stringify({
        action:'code',
        code: code
    }));
}

function clickArea(e){
    e.preventDefault();
    e.stopPropagation();
    const areaId = ($(this).attr('data-area'));
    ws.send(JSON.stringify({
        action:'area',
        areaId: areaId
    }));
}

async function showAreaName(e){
    const areaId = $(this).data('area');
    let name = $(this).data('name');
    name = await liquidify(name);
    $('#link-name').text(name);

    if (areaTimers[areaId]){
        clearTimeout(areaTimers[areaId]);
        delete areaTimers[areaId];
    }
}

function clearAreaName(e){
    $('#link-name').html('&nbsp;');
    const $area = $(this);
    const data = $area.data('maphilight') || {};
    data.alwaysOn = false;
    $area.data('maphilight', data).trigger('alwaysOn.maphilight');
}

function hideText(e){
    $('#game-text').hide();
}

function showAreas(e){
    e.preventDefault();
    for (const area in areaTimers){
        clearTimeout(areaTimers[area]);
    }
    areaTimers = {};
    $('area').each(function(i) {
        const $area = $(this);
        const areaId = $area.data('area');
        var data = $area.data('maphilight') || {};
        data.alwaysOn = true;
        $area.data('maphilight', data).trigger('alwaysOn.maphilight');
        const timeout = setTimeout(function(){
            data.alwaysOn = false;
            $area.data('maphilight', data).trigger('alwaysOn.maphilight');
        }, 2000);
        areaTimers[areaId] = timeout;
    });
}

async function liquidify(input){
    return engine.parseAndRender(input, gamedata);
}
