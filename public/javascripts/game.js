/* global pageTemplate */
let currentGameState = 0;
let textTimeout = null;
let ws = null;
const reconnectInterval = 5000;
let reconnectTimeout = null;

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
        console.log(data);
        switch(data.action){
            case 'show default': await renderDefault(); break;
            case 'show page': renderPage(data.gamestate); break;
            case 'load':  window.open(data.url, '_blank'); break;
            case 'display': showText(data); break;
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
    const response = await fetch('/game');
    if(!response.ok){
        throw new Error ('Got a bad response');
    }
    const content = await response.text();
    $('#game-content').html(content);
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

function showText(data){
    $('#game-text').html(data.content);
    $('#game-text').show();
    clearTimeout(textTimeout);
    if (data.duration){
        textTimeout = setTimeout(hideText, data.duration * 1000);
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
    $('#link-name').text($(this).attr('data-name'));
}

function clearAreaName(e){
    $('#link-name').html('&nbsp;');
}

function hideText(e){
    $('#game-text').hide();
}
