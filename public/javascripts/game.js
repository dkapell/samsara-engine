/* global _ pageTemplate toastTemplate popupTemplate addMessage handleChat hideChatSidebar showChatSidebar */
/* global currentLocation lookup liquidjs addChatEvent refreshPlayerList startVideo closeVideo resizable closeInk */
/* global handleInk */

const engine = new liquidjs.Liquid();
let currentScreen = null;
let textTimeout = null;
let ws = null;
const reconnectInterval = 5000;
let reconnectTimeout = null;
let areaTimers = {};
let gamedata = {};
let activeMeeting = null;
let currentMeeting = null;
let currentAreas = {};
let initialPageLoad = true;
let mapDisabled = 0;
let noServer = false;

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
            case 'noserver':
                noServer = true;
                ws.close();
                break;
            case 'show default': await renderDefault(data); break;
            case 'show page': {
                if (_.has(data, 'gamedata')){
                    for (const key in data.gamedata){
                        gamedata[key] = data.gamedata[key];
                    }
                }
                renderPage(data.screen, data.force);
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
            case 'closeink':
                closeInk(data);
                break;
            case 'ink': await handleInk(data); break;
        }

        if (data.codeAccept){
            $('#code-entry').removeClass('is-invalid');
            $('#code-entry').val('');
        }
    };

    ws.onclose = function(){
        ws = null;
        if (!noServer){
            reconnectTimeout = setTimeout(openWebSocket, 5000);
        }
    };
    ws.onopen = function () {
        const doc = {
            action:'history',
            options: {}
        };
        if ($('#chat-history-limit').val()){
            doc.options.limit = Number($('#chat-history-limit').val());
        }
        if (noServer){
            return;
        }

        ws.send(JSON.stringify(doc));
        setTimeout( () => {
            if (initialPageLoad){
                sendLeaveMeeting();
                initialPageLoad = false;
            } else {
                sendJoinMeeting();
            }
        }, 100);

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
                $('#chat-screen-tab-nav').show();
            } else {
                $('#chat-screen-tab-nav').hide();
                if (currentLocation === 'screen'){
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

async function renderPage(screen, force){
    if (currentScreen !== screen.id || force){
        let initialScreen = false;
        if (currentScreen === null){
            initialScreen = true;
        }
        $('#popupModal').modal('hide');
        $('#screen-image').mapster('tooltip');
        currentScreen = screen.id;
        screen.description = await(liquidify(screen.description));
        const rendered = pageTemplate({screen: screen});
        $('main').removeClass('container').addClass('container-fluid');
        $('#game-content').html(rendered);
        $('#code-feedback').hide();
        $('#code-form').on('submit', submitCodeForm);
        $('#code-entry').on('change keyup copy paste cut', function() {
            if (!this.value) {
                $(this).removeClass('is-invalid');
            }
        });

        if (screen.map) {
            currentAreas = screen.map.filter(area => {return _.has(area, 'meeting'); });
        } else {
            currentAreas = {};
        }

        prepImageMap();
        if (screen.chatSidebar){
            showChatSidebar(screen.chatExpanded);
            if (screen.chat){
                $('#chat-screen-tab-nav').show();
                if (!initialScreen && _.has(screen, 'name')){
                    addChatEvent('screen', screen.name);
                }
            } else {
                $('#chat-screen-tab-nav').hide();
                if (currentLocation === 'screen'){
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
            strokeWidth:1
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
            wrapClass: 'mapster-container',
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
        const $screenImage = $('#screen-image');
        $screenImage
            .mapster('unbind')
            .mapster(opts)
            .bind('click', function () {
                if (!inArea) {
                    $screenImage.mapster('set_options', allOpts)
                        .mapster('set', true, 'all')
                        .mapster('set_options', singleOpts);
                }
            })
            .bind('mouseout', function () {
                if (!inArea) {
                    $screenImage.mapster('set', false, 'all');
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
    const $screenImage = $('#screen-image');
    const opts = $screenImage.mapster('get_options');
    opts.areas = [];
    for (const area of tooltips){
        const doc = {
            key: area.name,
            toolTip: area.text
        };
        if (area.show){
            doc.selected=true;
            doc.staticScreen=true;
            doc.fillColor='00bc8c';
            doc.fillOpacity= 0.2;
        } else {
            doc.selected=false;

        }
        opts.areas.push(doc);

    }
    $screenImage.mapster('rebind', opts);
    $screenImage.mapster('set', false, 'all');
}

function resizeImageMap(noActions){
    if ($('#screen-image-holder')[0] && $('#screen-image-holder').is(':visible')){
        $('#screen-image-holder').addClass('hide');


        const imageHeight = $('#screen-image')[0].naturalHeight;
        const panelHeight = $('#screen-container').height();
        let newHeight = Math.min(imageHeight, panelHeight*0.55);
        if ($('#screen-image-holder').data('height')){
            newHeight = Math.max(newHeight, Number($('#screen-image-holder').data('height')));
        }

        const imageWidth = $('#screen-image')[0].naturalWidth;
        const panelWidth = $('#screen-container').width();
        const newWidth = Math.min(imageWidth, panelWidth);

        if (newWidth < newHeight * (imageWidth/imageHeight)){
            $('#screen-image').mapster('resize', newWidth, null);
        } else {
            $('#screen-image').mapster('resize', null, newHeight);
        }
        $('#screen-image-holder').removeClass('hide');
        if (noActions){

        }
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
        if (direction === 'vertical'){
            if (parseInt(prevSibling.style.height) < 3){
                $(resizer).find('.resizer-expand').hide();
                $(resizer).find('.resizer-restore').show();
            } else {
                $(resizer).find('.resizer-expand').show();
                $(resizer).find('.resizer-restore').hide();
            }
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
        if($('#screen-container').height() < 5){
            halfContent();

        } else {
            fullContent();
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
        const doc = {
            name: area.name,
            text: 'Empty',
            show: false
        };
        if (meeting.count + meeting.users.length === 0 ){
            data.push(doc);
            continue;
        }
        if (meeting.count && !meeting.users.length){
            doc.text = `${meeting.name} (${meeting.count})`;
        } else if (meeting.users){
            doc.text = _.pluck(meeting.users, 'name').join(', ');
            doc.show = true;
            if (meeting.count > meeting.users.length){
                doc.text += `, +${meeting.count-meeting.users.length} more`;
            }
        }

        data.push(doc);
    }
    updateImageMapTooltips(data);
}

function sendJoinMeeting(){
    if (!activeMeeting || noServer){
        return;
    }
    ws.send(JSON.stringify({
        action:'meeting',
        meetingId: currentMeeting,
        type: 'join'
    }));
}
function sendLeaveMeeting(){
    if (noServer){
        return;
    }
    ws.send(JSON.stringify({
        action:'meeting',
        meetingId: currentMeeting,
        type: 'leave'
    }));

}

function sendInkChoice(idx){
    if (noServer){
        return;
    }

    ws.send(JSON.stringify({
        action:'ink',
        type: 'choice',
        idx: idx
    }));
}

function sendCloseInkStory(){
    if (noServer){
        return;
    }

    ws.send(JSON.stringify({
        action:'ink',
        type: 'close'
    }));
}

function closeContent(){
    $('#screen-container')
        .removeClass('d-none')
        .addClass('d-flex')
        .css({height:'100%', overflow:'hidden'});
    $('#content-container')
        .addClass('d-none')
        .css({height:0, overflow:'hidden'});
    $('#content-adjust')
        .removeClass('d-flex')
        .addClass('d-none');
    resizeImageMap();
}

function fullContent(hideAdjust, hideClose = false){
    $('#screen-container')
        .removeClass('d-none')
        .addClass('d-flex')
        .css({height:0, overflow:'scroll'});
    if(hideAdjust){
        $('#content-adjust').addClass('d-none');
    } else {
        $('#content-adjust').removeClass('d-none');
    }

    if (hideClose){
        $('#content-adjust >> .resizer-close').addClass('d-none');
    } else {
        $('#content-adjust >> .resizer-close').removeClass('d-none');
    }

    $('#content-container')
        .removeClass('d-none')
        .addClass('d-flex')
        .css({height:'100%'});
    $('#content-adjust >> .resizer-expand').hide();
    $('#content-adjust >> .resizer-restore').show();
    resizeImageMap();
}

function halfContent(hideAdjust, hideClose = false){
    $('#screen-container')
        .removeClass('d-none')
        .addClass('d-flex')
        .css({height:'40%', overflow:'scroll'});
    if(hideAdjust){
        $('#content-adjust').addClass('d-none');
    } else {
        $('#content-adjust').removeClass('d-none');
    }

    if (hideClose){
        $('#content-adjust >> .resizer-close').addClass('d-none');
    } else {
        $('#content-adjust >> .resizer-close').removeClass('d-none');
    }

    $('#content-container')
        .removeClass('d-none')
        .css({height:'60%'});
    $('#content-adjust >> .resizer-expand').show();
    $('#content-adjust >> .resizer-restore').hide();

    resizeImageMap();
}

function closeSidebar(side){
    $('#game-container')
        .removeClass('d-none')
        .addClass('d-flex')
        .css({width:'100%', overflow:'hidden'});
    $(`#sidebar-${side}`)
        .addClass('d-none')
        .removeClass('d-flex')
        .css({width:0, overflow:'hidden'});
    resizeImageMap();
    enableMap(false);
}

function openSidebar(side, noActions, full){
    $(`#sidebar-${side}`)
        .removeClass('d-none')
        .addClass('d-flex');

    if (full){
        $('#game-container')
            .addClass('d-none')
            .removeClass('d-flex')
            .css({width:0, overflow:'scroll'});
        $(`#sidebar-${side}`)
            .removeClass('d-none')
            .addClass('d-flex')
            .addClass('no-border')
            .css({width:'100%'});
    } else {
        $('#game-container')
            .removeClass('d-none')
            .addClass('d-flex')
            .css({width:'60%', overflow:'scroll'});

        $(`#sidebar-${side}`)
            .removeClass('d-none')
            .addClass('d-flex')
            .removeClass('no-border')
            .css({width:'40%'});
    }
    resizeImageMap();
    disableMap();

}

function disableMap(){
    mapDisabled++;
    $('.mapster-container').addClass('click-disabled');
}

function enableMap(force){
    if (force){
        mapDisabled = 0;
    } else if (mapDisabled > 0){
        mapDisabled--;
    }
    if (!mapDisabled){
        $('.mapster-container').removeClass('click-disabled');
    }
}
