/* global _ JitsiMeetExternalAPI resizeImageMap prepImageMap gamedata resizable ws sendJoinMeeting*/
/* global activeMeeting:writable currentMeeting:writable */

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
    if (meeting.subject){
        options.subject = meeting.subject;
    }

    if (!meeting.gm){
        options.configOverwrite = {
            toolbarButtons: [
                'microphone', 'camera', 'closedcaptions',
                'fodeviceselection', 'hangup', 'profile',
                'settings', 'videoquality', 'filmstrip',
                'tileview', 'select-background'
            ],
            notifications: [
                'connection.CONNFAIL', // shown when the connection fails,
                'dialog.cameraNotSendingData', // shown when there's no feed from user's camera
                'dialog.liveStreaming', // livestreaming notifications (pending, on, off, limits)
                'dialog.lockTitle', // shown when setting conference password fails
                'dialog.maxUsersLimitReached', // shown when maximmum users limit has been reached
                'dialog.micNotSendingData', // shown when user's mic is not sending any audio
                'dialog.passwordNotSupportedTitle', // shown when setting conference password fails due to password format
                'dialog.recording', // recording notifications (pending, on, off, limits)
                'dialog.remoteControlTitle', // remote control notifications (allowed, denied, start, stop, error)
                'dialog.reservationError',
                'dialog.serviceUnavailable', // shown when server is not reachable
                'dialog.sessTerminated', // shown when there is a failed conference session
                'dialog.sessionRestarted', // show when a client reload is initiated because of bridge migration
                'dialog.tokenAuthFailed', // show when an invalid jwt is used
                'dialog.transcribing', // transcribing notifications (pending, off)
                'dialOut.statusMessage', // shown when dial out status is updated.
                'liveStreaming.busy', // shown when livestreaming service is busy
                'liveStreaming.failedToStart', // shown when livestreaming fails to start
                'liveStreaming.unavailableTitle', // shown when livestreaming service is not reachable
                'lobby.joinRejectedMessage', // shown when while in a lobby, user's request to join is rejected
                'lobby.notificationTitle', // shown when lobby is toggled and when join requests are allowed / denied
                'localRecording.localRecording', // shown when a local recording is started
                'notify.disconnected', // shown when a participant has left
                'notify.invitedOneMember', // shown when 1 participant has been invited
                'notify.invitedThreePlusMembers', // shown when 3+ participants have been invited
                'notify.invitedTwoMembers', // shown when 2 participants have been invited
                'notify.mutedRemotelyTitle', // shown when user is muted by a remote party
                'notify.mutedTitle', // shown when user has been muted upon joining,
                'notify.newDeviceAudioTitle', // prompts the user to use a newly detected audio device
                'notify.newDeviceCameraTitle', // prompts the user to use a newly detected camera
                'notify.passwordSetRemotely', // shown when a password has been set remotely
                'notify.raisedHand', // shown when a partcipant used raise hand,
                'notify.startSilentTitle', // shown when user joined with no audio
                'prejoin.errorDialOut',
                'prejoin.errorDialOutDisconnected',
                'prejoin.errorDialOutFailed',
                'prejoin.errorDialOutStatus',
                'prejoin.errorStatusCode',
                'prejoin.errorValidation',
                'recording.busy', // shown when recording service is busy
                'recording.failedToStart', // shown when recording fails to start
                'recording.unavailableTitle', // shown when recording service is not reachable
                'toolbar.noAudioSignalTitle', // shown when a broken mic is detected
                'toolbar.noisyAudioInputTitle', // shown when noise is detected for the current microphone
                'toolbar.talkWhileMutedPopup', // shown when user tries to speak while muted
                'transcribing.failedToStart' // shown when transcribing fails to start
            ]
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
        sendJoinMeeting();
    });
    activeMeeting.addListener('participantRoleChanged', function(data){
        if (data.role === 'moderator' && meeting.subject){
            activeMeeting.executeCommand('subject', meeting.subject);
        }
    });
    activeMeeting.addListener('videoConferenceLeft', closeVideo);
    activeMeeting.addListener('participantKickedOut', function(data){
        if (data.kicked.local) {
            closeVideo();
        }
    });
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
    ws.send(JSON.stringify({
        action:'meeting',
        meetingId: currentMeeting,
        type: 'leave'
    }));
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
        .css({height:'40%', overflow:'scroll'});
    $('#video-adjust').removeClass('d-none');
    $('#video-container')
        .removeClass('d-none')
        .css({height:'60%'});
    $('#video-adjust >> .resizer-expand').show();
    $('#video-adjust >> .resizer-restore').hide();

    resizeImageMap();
}
