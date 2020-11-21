let currentGameState = 0;
let refreshInterval = null;
$(function(){
    fetchGamePage();
    refreshInterval = setInterval(fetchGamePage, 2000);
});

async function fetchGamePage(){

    try{
        const response = await fetch('/game');
        if(!response.ok){
            console.log('Got a bad response');
            clearInterval(refreshInterval);
            return;
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
        clearInterval(refreshInterval);
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
    $('area').on('click', clickRoom);
    $('area').on('mouseover', showRoom);
    $('area').on('mouseout', clearRoom);
}

async function submitCodeForm(e){
    e.preventDefault();
    $('#code-feedback').hide();
    const code = $('#code-entry').val();
    checkRoom(code);
}

async function clickRoom(e){
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
        } // add display text
    }
}

async function checkRoom(code){
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

function showRoom(e){
    $('#room-name').text($(this).attr('data-name'));
}

function clearRoom(e){
    $('#room-name').html('&nbsp;');
}
