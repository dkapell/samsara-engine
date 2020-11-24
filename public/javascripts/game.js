let currentGameState = 0;
let refreshInterval = null;
let textTimeout = null;
let defaulRefreshTime = 1000;
let maxRefreshTime = 30000;
let refreshTime = defaulRefreshTime;
$(function(){
    $('#game-text').hide();
    fetchGamePage();
});

async function fetchGamePage(){

    try{
        const response = await fetch('/game');
        if(!response.ok){
            throw new Error ('Got a bad response');
        }
        const siteRefreshTime = response.headers.get('x-game-refresh');
        if (siteRefreshTime){
            refreshTime = siteRefreshTime;
        } else {
            refreshTime = defaulRefreshTime;
        }
        const gameState = response.headers.get('x-game-state');
        if (gameState !== currentGameState){
            currentGameState = gameState;
            const content = await response.text();
            $('#game-content').html(content);
            $('#code-feedback').hide();
            $('#code-form').on('submit', submitCodeForm);
            $('#code-entry').on('change keyup copy paste cut', function() {
                if (!this.value) {
                    $(this).removeClass('is-invalid');
                }
            });
            prepImageMap();

        }
    } catch (e){
        console.log(e);
        refreshTime = refreshTime * 2;
        if (refreshTime > maxRefreshTime){
            refreshTime = maxRefreshTime;
        }

    }
    refreshInterval = setTimeout(fetchGamePage, refreshTime);
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
    $('area').on('click', clickLink);
    $('area').on('mouseover', showLink);
    $('area').on('mouseout', clearLink);
}

async function submitCodeForm(e){
    e.preventDefault();
    $('#code-feedback').hide();
    const code = $('#code-entry').val();
    checkLink(code);
}

async function clickLink(e){
    e.preventDefault();
    e.stopPropagation();
    const areaId = ($(this).attr('data-area'));
    const response = await fetch('/game/area/'+ areaId);
    const data = await response.json();
    if (!data.success){
        console.log(data);
        return;
    }
    performActions(data.actions);
}

function performActions(actions){
    for (const action of actions){
        if (action.action === 'load'){
            window.open(action.url, '_blank');
        } else if (action.action === 'reload'){
            fetchGamePage();
        } else if (action.action === 'display'){
            $('#game-text').html(action.content);
            $('#game-text').show();
            clearTimeout(textTimeout);
            if (action.duration){
                textTimeout = setTimeout(hideText, action.duration * 1000);
            }
        }
    }
}

async function checkLink(code){
    const response = await fetch('/game/code/'+ code);
    const data = await response.json();
    if (!data.success){
        $('#code-entry').addClass('is-invalid');
        if (!data.retry){
            console.log('clear');
            $('#code-entry').val('');
        }
        $('#code-feedback').text(data.error);
        $('#code-feedback').show();
        return;
    }
    $('#code-entry').removeClass('is-invalid');
    $('#code-entry').val('');
    performActions(data.actions);
}

function showLink(e){
    $('#link-name').text($(this).attr('data-name'));
}

function clearLink(e){
    $('#link-name').html('&nbsp;');
}

function hideText(e){
    $('#game-text').hide();
}
