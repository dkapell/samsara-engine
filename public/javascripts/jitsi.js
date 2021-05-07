/* global _ JitsiMeetExternalAPI resizeImageMap prepImageMap gamedata resizable */

let activeMeeting = null;
let currentMeeting = null;

$(function(){
    $('#video-adjust >> .resizer-expand').on('click', function(e){
        e.stopPropagation();
        fullVideo();
    });
    $('#video-adjust >> .resizer-restore').on('click', function(e){
        e.stopPropagation();
        halfVideo();
    });
    $('#video-adjust >> .resizer-close').on('click', function(e){
        e.stopPropagation();
        closeVideo();
    });
});

function startVideo(meeting, postStart){
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
                'etherpad', 'shareaudio', 'settings',
                'videoquality', 'filmstrip', 'shortcuts',
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
        if (meeting.postStart && _.isFunction(meeting.postStart)){
            meeting.postStart(data);
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
    $('#video-adjust >> .resizer-expand').hide();
    $('#video-adjust >> .resizer-restore').show();
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
    $('#video-adjust >> .resizer-expand').show();
    $('#video-adjust >> .resizer-restore').hide();

    resizeImageMap();
}

