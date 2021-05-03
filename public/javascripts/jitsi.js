/* global JitsiMeetExternalAPI resizeImageMap prepImageMap gamedata */

let activeMeeting = null;
let currentMeeting = null;

function startVideo(meeting){
    const $videoContainer = $('#video-container');
    if (activeMeeting){
        if (currentMeeting === meeting.meetingName){
            return;
        }
        activeMeeting.executeCommand('hangup');
        closeVideo();
    }

    var options = {
        roomName: meeting.meetingName,
        width: '100%',
        height: '100%',
        parentNode: $videoContainer[0]
    };

    if (meeting.jwt){
        options.jwt = meeting.jwt;
    }

    if (!meeting.gm){
        options.configOverwrite = {
            toolbarButtons: [
                'microphone', 'camera', 'closedcaptions',
                'fodeviceselection', 'hangup', 'profile',
                'settings', 'videoquality', 'filmstrip',
                'tileview', 'select-background'
            ],
        };
    } else {
        options.configOverwrite = {
            toolbarButtons: [
                'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
                'fodeviceselection', 'hangup', 'profile', 'recording',
                'etherpad', 'sharedvideo', 'shareaudio', 'settings',
                'videoquality', 'filmstrip', 'stats', 'shortcuts',
                'tileview', 'select-background', 'mute-everyone', 'mute-video-everyone', 'security'
            ],
        };
    }

    if (gamedata && gamedata.character){
        options.userInfo = {displayName: gamedata.character};
    } else if (meeting.displayName){
        options.userInfo = {displayName: meeting.displayName};
    }

    if (meeting.fullscreen || $('#game-content').height() < 600 || $('#game-content').width() < 768){
        fullVideo();
    } else {
        halfVideo();
    }

    activeMeeting = new JitsiMeetExternalAPI(meeting.domain, options);

    activeMeeting.addListener('videoConferenceJoined', function(data) {
        if (gamedata && gamedata.character){
            activeMeeting.executeCommand('displayName', gamedata.character);
        }
    });
    activeMeeting.addListener('participantRoleChanged', function(data){
        if (data.role === 'moderator' && meeting.subject){
            activeMeeting.executeCommand('subject', meeting.subject);
        }
    });
    activeMeeting.addListener('videoConferenceLeft', closeVideo);
    resizeImageMap();
    currentMeeting = meeting.meetingName;
}

function closeVideo(){
    $('#gamestate-container')
        .removeClass('d-none')
        .addClass('d-flex')
        .css({height:'100%', overflow:'hidden'});
    $('#video-container')
        .addClass('d-none')
        .css({height:0, overflow:'hidden'});
    $('#video-adjust')
        .removeClass('d-flex')
        .addClass('d-none');
    resizeImageMap();
    if (activeMeeting){
        activeMeeting.dispose();
        activeMeeting = null;
    }
}

function fullVideo(hideAdjust){
    $('#gamestate-container')
        .removeClass('d-none')
        .addClass('d-flex')
        .css({height:0, overflow:'scroll'});
    if(hideAdjust){
        $('#video-adjust').addClass('d-none');
    } else {
        $('#video-adjust').removeClass('d-none');
    }
    $('#video-container')
        .removeClass('d-none')
        .addClass('d-flex')
        .css({height:'100%'});
    resizeImageMap();
}

function halfVideo(){
    $('#gamestate-container')
        .removeClass('d-none')
        .addClass('d-flex')
        .css({height:'50%', overflow:'scroll'});
    $('#video-adjust').removeClass('d-none');
    $('#video-container')
        .removeClass('d-none')
        .css({height:'50%'});
    resizeImageMap();
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

