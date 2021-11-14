/* global _ pageTemplate toastTemplate popupTemplate addMessage handleChat hideChatSidebar showChatSidebar */
/* global currentLocation lookup liquidjs addChatEvent refreshPlayerList startVideo closeVideo resizable halfVideo fullVideo*/
const engine = new liquidjs.Liquid();
let currentGameState = null;
let textTimeout = null;
let ws = null;
const reconnectInterval = 5000;
let reconnectTimeout = null;
let areaTimers = {};
let gamedata = {};
let activeMeeting = null;
let currentMeeting = null;
let currentAreas = {};

$(function(){
    $('#game-text').hide();
    openWebSocket();

    $( window ).resize(function() {
        resizeImageMap();
    });
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
                renderPage(data.gamestate, data.force);
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
            case 'meetings': showMeetings(data.meetings); break;
            case 'playerupdate':
                if (typeof refreshPlayerList === 'function'){
                    await refreshPlayerList();
                }
                break;
            case 'video':
                startVideo(data);
                break;
            case 'closevideo':
                closeVideo(data);
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
        sendJoinMeeting();

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
        console.log(err);

        $('#game-content').html($err);
    }
}

async function renderPage(gamestate, force){
    if (currentGameState !== gamestate.id || force){
        let initialState = false;
        if (currentGameState === null){
            initialState = true;
        }
        $('#popupModal').modal('hide');
        currentGameState = gamestate.id;
        gamestate.description = await(liquidify(gamestate.description));
        const rendered = pageTemplate({gamestate: gamestate});
        $('main').removeClass('container').addClass('container-fluid');
        $('#game-content').html(rendered);
        $('#code-feedback').hide();
        $('#code-form').on('submit', submitCodeForm);
        $('#code-entry').on('change keyup copy paste cut', function() {
            if (!this.value) {
                $(this).removeClass('is-invalid');
            }
        });

        currentAreas = gamestate.map.filter(area => {return _.has(area, 'meeting'); });

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
        let inArea = false;
        const allOpts = {
            strokeColor: 'ffffff',
            strokeOpacity: 0.5,
            fillColor: 'ffffff',
            fillOpacity: 0.2,
            stroke:true,
            strokeWidth:1,
        };
        const singleOpts ={
            strokeColor: 'ffffff',
            strokeOpacity: 0.5,
            fillColor: 'e74c3c',
            fillOpacity: 0.4,
            stroke:true,
            strokeWidth:1,
            showToolTip: true,
            toolTipContainer:  $('<div>')
                .addClass('border')
                .addClass('border-light')
                .addClass('rounded')
                .addClass('bg-dark')
                .addClass('text-light')
                .addClass('p-2')
                .addClass('mb-1')
                .addClass('shadow-sm'),
            //areas: []
        };

        const initialOpts = {
            mapKey: 'data-groups',
            isSelectable: false,
            toolTipClose: ['area-mouseout', 'area-click'],
            onMouseover: function (data) {
                showAreaName(data.key);
                inArea = true;
            },
            onMouseout: function (data) {
                clearAreaName();
                inArea = false;
            }
        };
        const opts = $.extend({}, allOpts, initialOpts, singleOpts);
        const $gamestateImage = $('#gamestate-image');
        $gamestateImage
            .mapster('unbind')
            .mapster(opts)
            .bind('click', function () {
                if (!inArea) {
                    $gamestateImage.mapster('set_options', allOpts)
                        .mapster('set', true, 'all')
                        .mapster('set_options', singleOpts);
                }
            })
            .bind('mouseout', function () {
                if (!inArea) {
                    $gamestateImage.mapster('set', false, 'all');
                }
            });

        $('area').on('click', clickArea);
        resizeImageMap();

        return;
    } else {
        setTimeout(prepImageMap, 150);
    }
}

function updateImageMapTooltips(tooltips){
    const $gamestateImage = $('#gamestate-image');
    const opts = $gamestateImage.mapster('get_options');
    opts.areas = [];
    for (const area of tooltips){
        const doc = {
            key: area.name,
            toolTip: area.text
        };
        if (area.show){
            doc.selected=true;
            doc.staticState=true;
            doc.fillColor='00bc8c';
            doc.fillOpacity= 0.2;
        }
        opts.areas.push(doc);

    }
    $gamestateImage.mapster('set_options', opts);
}

function resizeImageMap(){
    if ($('#gamestate-image-holder')[0] && $('#gamestate-image-holder').is(':visible')){
        $('#gamestate-image-holder').addClass('hide');


        const imageHeight = $('#gamestate-image')[0].naturalHeight;
        const panelHeight = $('#gamestate-container').height();
        let newHeight = Math.min(imageHeight, panelHeight*0.55);
        if ($('#gamestate-image-holder').data('height')){
            newHeight = Math.max(newHeight, Number($('#gamestate-image-holder').data('height')));
        }

        const imageWidth = $('#gamestate-image')[0].naturalWidth;
        const panelWidth = $('#gamestate-container').width();
        const newWidth = Math.min(imageWidth, panelWidth);

        if (newWidth < newHeight * (imageWidth/imageHeight)){
            $('#gamestate-image').mapster('resize', newWidth, null);
        } else {
            $('#gamestate-image').mapster('resize', null, newHeight);
        }
        $('#gamestate-image-holder').removeClass('hide');
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

async function showAreaName(name){

    const areaId = $(this).data('area');
    //let name = $(this).data('name');
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

function resizable(resizer) {
    const direction = resizer.getAttribute('data-direction') || 'horizontal';
    const prevSibling = resizer.previousElementSibling;
    const nextSibling = resizer.nextElementSibling;

    // The current position of mouse
    let x = 0;
    let y = 0;
    let prevSiblingHeight = 0;
    let prevSiblingWidth = 0;

    // Handle the mousedown event
    // that's triggered when user drags the resizer
    const mouseDownHandler = function(e) {
        // Get the current mouse position
        x = e.clientX;
        y = e.clientY;
        const rect = prevSibling.getBoundingClientRect();
        prevSiblingHeight = rect.height;
        prevSiblingWidth = rect.width;

        // Attach the listeners to `document`
        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
    };

    const mouseMoveHandler = function(e) {
        // How far the mouse has been moved
        const dx = e.clientX - x;
        const dy = e.clientY - y;

        switch (direction) {
            case 'vertical':{
                const h = (prevSiblingHeight + dy) * 100 / resizer.parentNode.getBoundingClientRect().height;
                prevSibling.style.height = `${h}%`;
                nextSibling.style.height = `${100-h}%`;
                break;
            }
            case 'horizontal':
            default:{
                const w = (prevSiblingWidth + dx) * 100 / resizer.parentNode.getBoundingClientRect().width;
                prevSibling.style.width = `${w}%`;
                break;
            }
        }

        const cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
        resizer.style.cursor = cursor;
        document.body.style.cursor = cursor;

        prevSibling.style.userSelect = 'none';
        prevSibling.style.pointerEvents = 'none';

        nextSibling.style.userSelect = 'none';
        nextSibling.style.pointerEvents = 'none';

        if (parseInt(prevSibling.style.height) < 3){
            $('#video-adjust >> .resizer-expand').hide();
            $('#video-adjust >> .resizer-restore').show();
        } else {
            $('#video-adjust >> .resizer-expand').show();
            $('#video-adjust >> .resizer-restore').hide();
        }
    };

    const mouseUpHandler = function() {
        resizer.style.removeProperty('cursor');
        document.body.style.removeProperty('cursor');

        prevSibling.style.removeProperty('user-select');
        prevSibling.style.removeProperty('pointer-events');

        nextSibling.style.removeProperty('user-select');
        nextSibling.style.removeProperty('pointer-events');

        // Remove the handlers of `mousemove` and `mouseup`
        document.removeEventListener('mousemove', mouseMoveHandler);
        document.removeEventListener('mouseup', mouseUpHandler);

        resizeImageMap();
    };

    // Attach the handler
    resizer.addEventListener('mousedown', mouseDownHandler);
    resizer.addEventListener('dblclick', function(){
        if($('#gamestate-container').height() < 5){
            halfVideo();
        } else {
            fullVideo();
        }
    });
}
function showMeetings(meetings){
    const data = [];
    for (const meeting of meetings){
        const area = _.findWhere(currentAreas, {meeting: meeting.id});
        if (!area){
            continue;
        }
        console.log(area);
        console.log(meeting);

        let text = meeting.name;
        if (meeting.count){
            text += ` (${meeting.count})`;
        }
        if (meeting.users){
            text+= '<br>';
            text+= _.pluck(meeting.users, 'name').join(', ');
        }

        data.push({
            name: area.name,
            text: text,
            show:true,
        });
    }
    updateImageMapTooltips(data);
}

function sendJoinMeeting(){
    if (!activeMeeting){
        return;
    }
    ws.send(JSON.stringify({
        action:'meeting',
        meetingId: currentMeeting,
        type: 'join'
    }));
}
