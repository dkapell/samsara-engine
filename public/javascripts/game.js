/* global pageTemplate toastTemplate popupTemplate */
let currentGameState = 0;
let textTimeout = null;
let ws = null;
const reconnectInterval = 5000;
let reconnectTimeout = null;
let areaTimers = {};

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
            case 'show default': await renderDefault(); break;
            case 'show page': renderPage(data.gamestate); break;
            case 'load':  window.open(data.url, '_blank'); break;
            case 'display': showText(data); break;
            case 'toast': showToast(data); break;
            case 'image': showPopup('image', data); break;
            case 'code error':
                $('#code-entry').addClass('is-invalid');
                if (!data.retry){
                    $('#code-entry').val('');
                }
                $('#code-feedback').text(data.error);
                $('#code-feedback').show();
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

}

async function renderDefault(){
    try{
        const response = await fetch('/game');
        if(!response.ok){
            throw new Error ('Got a bad response');
        }
        const content = await response.text();
        $('#game-content').html(content);
    } catch (err){
        const $err = $('<div>')
            .addClass('alert')
            .addClass('alert-danger')
            .text('Could not connect to game, please try again in a short while.  If this problem persists, please contact the GMs');


        $('#game-content').html($err);
    }
}

function renderPage(gamestate){
    if (currentGameState !== gamestate.id){
        currentGameState = gamestate.id;
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
    }
}

function showToast(data){
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

function showText(data){
    $('#game-text').html(data.content);
    $('#game-text').show();
    clearTimeout(textTimeout);
    if (data.duration){
        textTimeout = setTimeout(hideText, data.duration * 1000);
    }
}

function showPopup(type, data){
    const $modal = $('#popupModal');
    if (type === 'image'){
        $modal.find('.modal-title').text(data.name);
        $modal.find('.modal-body').html(popupTemplate(data));
        $modal.modal('show');
    }
}

function prepImageMap(){
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

function showAreaName(e){
    const areaId = $(this).data('area');
    $('#link-name').text($(this).data('name'));

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

