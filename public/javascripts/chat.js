/* global chatmessageTemplate chatreportTemplate scrollSmoothToBottom ws _ */
let lastMessage = {
    gamestate:null,
    group:null,
    direct:null,
    gm:null
};
let chatUsers = {
    current: [],
    gamestate: {},
    group: {}
};
let myUserId = null;
let currentLocation = 'gamestate';
let currentLocationId = {
    gamestate:null,
    group:null,
    direct:null,
    gm:null,
};
let messagesSeen = {};
let blockedUsers = [];

let hideGamestateLocation = false;

$(function(){
    $('.chat-main').hide();
    $('#chat-form').on('submit', sendMessage);
    $('.chat-location').on('change', changeLocationId).hide();

    $('#chat-tabs a[data-toggle="tab"]').on('shown.bs.tab', showChatTab);
    $('.chat-container').on('scroll', clearNewMessagesOnScroll);
    $('#chat-message-input-input').on('focus', clearNewMessagesOnFocus);

    $(`#chat-location-${currentLocation}`).show();
});


function sendMessage(e){
    e.preventDefault();
    const content = $('#chat-message-input').val();
    const $location = $('.chat-location').find(':selected');
    const message = {
        action: 'chat',
        type: 'message',
        location: currentLocation,
        content: content,
    };
    if (currentLocationId[currentLocation]){
        message.location_id= Number(currentLocationId[currentLocation]);
    }
    ws.send(JSON.stringify(message));

    $('#chat-message-input').val('');
}

function handleChat(data){
    if (_.has(data, 'userId')){
        myUserId = data.userId;
    }
    if (_.has(data, 'read')){
        messagesSeen = data.read;
    }
    if (_.has(data, 'block')){
        blockedUsers = data.block;
    }

    if (_.has(data, 'messages')){
        addMessages(data.messages);
    } else if (_.has(data, 'locations')){
        addLocations(data.locations);
        $('.chat-location').change();
    } else if (_.has(data, 'remove')){
        removeMessage(data.remove);
    }
}

function addMessages(messages){
    $('#chat-loading').hide();
    $('.chat-main').show();

    for (const message of messages){
        if (message.type === 'report'){
            addReport(message, messages.length > 10);
        } else {
            addChatMessage(message, messages.length > 10);
        }
    }
}

function addChatMessage(message, fastScroll){
    const $chatContainer = $(`#chat-${message.location}-tab >> .chat-container`);
    const $existing = $chatContainer.find(`li[data-messageid="${message.message_id}"]`);
    if ($existing.length){
        return;
    }
    if (message.location === 'direct'){
        if (message.self){
            message.direct_location_name = message.location_fullname?message.location_fullname:message.location_name;
        } else {
            message.direct_location_name = message.recipient_type === 'player'?message.sender:message.sender.full;
        }
        addLocationOption(message.direct_location_name, 'direct', message.self?message.location_id:message.user_id);
    }
    if (!message.self && !$chatContainer.find('.first-new').length){
        if (_.has(messagesSeen, message.location)){
            if (new Date(message.created) > new Date(messagesSeen[message.location].seen)){
                message.firstNew = true;
            }
        } else {
            message.firstNew = true;
        }
    }
    if (_.indexOf(blockedUsers, message.user_id) !== -1){
        message.hidden = true;
        message.blockedUser = true;
    }

    const $message = $($.parseHTML(chatmessageTemplate({message: message, last:lastMessage[message.location], forReport:false})));
    $message.find('.chat-message-actions').hide();
    $message.hover(
        function(e){$(this).find('.chat-message-actions').show();},
        function(e){$(this).find('.chat-message-actions').hide();},
    );
    $message.find('.chat-message-user').on('click', clickMessageUser);
    $message.find('.chat-message-location').on('click', clickMessageLocation);
    $message.find('.chat-message-report')
        .tooltip({
            placement:'bottom',
            title:'Report Message'
        })
        .confirmation({
            title: 'Report Message?',
            placement:'auto',
        })
        .on('click', reportMessage);


    $message.find('.chat-message-block').on('click', blockUser);
    setBlockTitle($message.find('.chat-message-block'), message.blockedUser);

    $message.find('.message-text')
        .on('click', function(e){
            if ($(this).hasClass('hidden')){
                showMessage($message);
            }
        });
    lastMessage[message.location] = message;
    $chatContainer.append($message);
    scrollSmoothToBottom($chatContainer, fastScroll);
    if (_.has(messagesSeen, message.location)){
        if (new Date(message.created) < new Date(messagesSeen[message.location].seen)){
            return;
        }
    }
    if (!message.self){
        notifyNewChat(message.location, message.location_id);
    }
}

function addReport(message, fastScroll){
    const $chatContainer = $('#chat-report-tab >> .chat-container');
    if (!$chatContainer.length){ return; }
    if (!$chatContainer.find('.first-new').length){
        if (_.has(messagesSeen, 'report')){
            if (new Date(message.created) > new Date(messagesSeen.report.seen)){
                message.firstNew = true;
            }
        } else {
            message.firstNew = true;
        }
    }

    const $message = $($.parseHTML(chatmessageTemplate({message: message.message, last:null, forReport:true})));
    const $report = $($.parseHTML(chatreportTemplate({report: message})));
    $report.find('.message-holder').html($message);
    $report.find('.chat-report-actions').hide();
    $report.hover(
        function(e){$(this).find('.chat-report-actions').show();},
        function(e){$(this).find('.chat-report-actions').hide();},
    );
    $report.find('.chat-report-resolution').tooltip();
    $report.find('.chat-report-remove')
        .tooltip({
            placement:'bottom',
            title:'Remove Message'
        })
        .confirmation({
            title: 'Remove Message?',
            placement:'auto',
        })
        .on('click', removeReportedMessage);
    $report.find('.chat-report-ignore')
        .tooltip({
            placement:'bottom',
            title:'Reject Report'
        })
        .confirmation({
            title: 'Reject Report?',
            placement:'auto',
        })
        .on('click', ignoreReport);
    $report.find('.chat-report-clear')
        .tooltip({
            placement:'bottom',
            title:'Clear Report Action'
        })
        .confirmation({
            title: 'Clear Report Action?',
            placement:'auto',
        })
        .on('click', clearReport);

    $message.on('click', jumpToMessage);

    const $existing = $chatContainer.find(`li[data-reportid="${message.report_id}"]`);

    if ($existing.length){
        $existing.replaceWith($report);
    } else {
        $chatContainer.append($report);
        scrollSmoothToBottom($chatContainer, fastScroll);

        if (_.has(messagesSeen, 'report')){
            if (new Date(message.created) < new Date(messagesSeen.report.seen)){
                return;
            }
        }
        notifyNewChat('report');
    }
}

function jumpToMessage(e){
    e.preventDefault();
    const location = $(this).data('location');
    const message_id = $(this).data('messageid');
    const $chatContainer = $(`#chat-${location}-tab >> .chat-container`);
    const $message =  $chatContainer.find(`.chat-message[data-messageid="${message_id}`);
    if ($message.length){
        $message.addClass('message-selected');
        $(`#chat-${location}-tab-nav`).tab('show').one('shown.bs.tab', () => {
            $chatContainer.scrollTo($message);
        });
    }
}

function removeReportedMessage(e){
    e.preventDefault();
    const $report = $(this).closest('.chat-report');
    ws.send(JSON.stringify({
        action: 'chat',
        type: 'report-remove',
        report_id: $report.data('reportid'),
    }));
}

function ignoreReport(e){
    e.preventDefault();
    const $report = $(this).closest('.chat-report');
    ws.send(JSON.stringify({
        action: 'chat',
        type: 'report-ignore',
        report_id: $report.data('reportid'),
    }));
}

function clearReport(e){
    e.preventDefault();
    const $report = $(this).closest('.chat-report');
    ws.send(JSON.stringify({
        action: 'chat',
        type: 'report-clear',
        report_id: $report.data('reportid'),
    }));
}

function setBlockTitle($btn, blocked){
    const $message = $btn.closest('.chat-message');
    const sender = $message.data('sender');
    $btn.confirmation('dispose');
    $btn.tooltip('dispose');
    if(blocked){
        $btn.tooltip({
            placement:'bottom',
            title:'Unblock User'
        })
            .confirmation({
                title: `Unblock ${sender}?`,
                placement:'auto'
            });
    } else {
        $btn.tooltip({
            placement:'bottom',
            title:'Block User'
        })
            .confirmation({
                title: `Block ${sender}?`,
                placement:'auto'
            });
    }
}

function removeMessage(message_id){
    $(`.chat-message[data-messageid="${message_id}"]`).remove();
}


function reportMessage(e){
    e.preventDefault();
    const $message = $(this).closest('.chat-message');
    hideMessage($message);
    ws.send(JSON.stringify({
        action: 'chat',
        type: 'report',
        message_id: $message.data('messageid'),
    }));
}

function blockUser(e){
    e.preventDefault();
    const $self = $(this);
    const blocked = $self.data('blocked');

    const $message = $(this).closest('.chat-message');
    const user_id = $message.data('userid');
    ws.send(JSON.stringify({
        action: 'chat',
        type: blocked?'unblock':'block',
        user_id: $message.data('userid'),
    }));

    setBlockTitle($self, !blocked);

    if (blocked){
        $self.find('i.fas')
            .removeClass('fa-eye')
            .addClass('fa-eye-slash');
        $self.data('blocked', false);
        $(`.chat-message[data-userid="${user_id}"]`).each(function(idx) {
            showMessage($(this));
        });
        blockedUsers = blockedUsers.filter(id => {
            return id !== user_id;
        });


    } else {
        blockedUsers.push(user_id);
        $self.find('i.fas')
            .removeClass('fa-eye-slash')
            .addClass('fa-eye');
        $self.data('blocked', true);
        $(`.chat-message[data-userid="${user_id}"]`).each(function(idx) {
            hideMessage($(this));
        });

    }
}


function showMessage($message){
    const $text = $message.find('.message-text.hidden');
    $text
        .removeClass('hidden')
        .html($text.data('messagecontent'));
}

function hideMessage($message){
    const $text = $message.find('.message-text');
    if ($text.hasClass('hidden')){ return; }
    $text
        .addClass('hidden')
        .data('messagecontent', $text.html())
        .html('Click to show hidden message.');
}


function clickMessageUser(e){
    e.preventDefault();
    const $self = $(this);
    const userId = $self.data('userid');
    const isSelf = $self.data('self');
    const name = $self.text();

    const $chatLocation = $('#chat-location-direct');
    $chatLocation.find('option').attr('selected', false);

    const $option = $chatLocation.find(`option[value="${userId}"]`);
    if($option[0]){
        $option.attr('selected', 'selected');
        $('.chat-location').change();
        $('#chat-direct-tab-nav').tab('show');
        return;
    }
    addLocationOption($self.text(), 'direct', userId);
    $('.chat-location').change();
    $('#chat-direct-tab-nav').tab('show');
}

function clickMessageLocation(e){
    e.preventDefault();
    const $self = $(this);
    const location = $self.data('location');
    const $chatLocation = $('.chat-location');
    $chatLocation.find('option').attr('selected', false);
    switch(location){
        case 'gamestate':{
            const id = $self.data('locationid');
            const $option = $chatLocation.find(`option[value="${id}"]`);
            if($option.length){
                $option.attr('selected', 'selected');
                $('.chat-location').change();
                return;
            }
            addLocationOption($self.data('locationname'), 'gamestate', id);
            break;
        }
        case 'gm':
            $chatLocation.find('option[data-location="gm"]').attr('selected', 'selected');
            break;
        case 'group': {
            const id = $self.data('locationid');
            const $option = $chatLocation.find(`option[value="${id}"]`);
            if($option.length){
                $option.attr('selected', 'selected');
                $('.chat-location').change();
                return;
            }
            addLocationOption($self.data('locationname'), 'group', id);
            break;
        }
        case 'direct':{
            const id = $self.data('locationid');
            const $option = $chatLocation.find(`option[value="${id}"]`);
            if($option.length){
                $option.attr('selected', 'selected');
                $('.chat-location').change();
                return;
            }
            addLocationOption($self.data('locationname'), 'direct', id);
            break;
        }
    }
    $('.chat-location').change();

}
function addLocations(locations){
    for (const type in locations){
        if (type === 'current'){
            $('#chat-location-gamestate').hide();
            hideGamestateLocation = true;
            if (locations.current){
                chatUsers.current = locations.current;
                showUsers('gamestate', null, true);
            }
            continue;
        } else if (type === 'group'){
            if (locations[type].length === 0){
                $('#chat-group-tab-nav').hide();
                if (currentLocation === 'group'){
                    $('#chat-tabs').find('li:visible:first').find('a').tab('show');
                }
            } else {
                $('#chat-group-tab-nav').show();
            }
        }

        for (const location of locations[type]){
            let name  = location.name;
            if (location.users){
                chatUsers[type][location.id] = location.users;
                name += ` (${location.users.length})`;
            }
            if (location === 'gamestate'){
                $('#chat-location-gamestate').show();
                hideGamestateLocation = false;
            }
            addLocationOption(name, type, location.id, false);
        }
    }
}

function addLocationOption(name, type, id, selected){
    if (selected === undefined){
        selected = true;
    }
    let $option = $(`#chat-location-${type}`).find(`option[value="${id}"]`);
    if($option.length){
        if ($option.text() !== name){
            $option.text(name);
        }
        return;
    }
    $option = $('<option>')
        .attr('selected', selected)
        .attr('data-location', type)
        .attr('data-locationid', id)
        .attr('data-name', name)
        .val(id)
        .text(name);

    $(`#chat-location-${type}`).append($option);
}

function changeLocationId(e){
    const $self = $(this);
    const $option = $self.find(':selected');
    const location = $self.data('location');
    const locationId = $option.val();

    currentLocationId[location] = locationId;
    showUsers(location, locationId, $option.data('player'));
}

function showUsers(location, locationId, player){
    const $userList =  $(`#chat-${location}-tab >> .chat-users`);

    $userList.empty();
    let users = [];
    if (location === 'gamestate' && chatUsers.current.length){
        users = chatUsers.current;
    } else if(_.has(chatUsers, location) && _.has(chatUsers[location], locationId)){
        users = chatUsers[location][locationId];
    }

    for(const user of users){
        const $user = $('<span>')
            .addClass('badge')
            .addClass(user.id === myUserId?'badge-secondary':'badge-primary')
            .addClass('chat-message-user')
            .addClass('m-1')
            .data('userid', user.id)
            .data('self', false)
            .text(user.name);

        if (user.id !== myUserId){
            $user.on('click', clickMessageUser);
        }

        $userList.append($user);
    }
}

function notifyNewChat(location, id){
    const $alert = $(`#chat-${location}-tab-nav > .chat-new-message-indicator`);
    let val = Number($alert.text());
    $alert.text(++val);
    const $globalAlert = $('#chat-new-messages');
    val = Number($globalAlert.text());
    $globalAlert.text(++val);
}

function clearChatNotify(location, id){
    const $alert = $(`#chat-${location}-tab-nav > .chat-new-message-indicator`);
    let val = Number($alert.text());
    $alert.text('');
    const $globalAlert = $('#chat-new-messages');
    let globalVal = Number($globalAlert.text());
    const newGlobalVal = globalVal - val;
    if (newGlobalVal){
        $globalAlert.text(newGlobalVal);
    } else {
        $globalAlert.text('');
    }
}

function clearNewMessagesOnScroll(e){
    const $self = $(this);
    const location = $self.data('location');
    const $elem = $self.find('.first-new');

    if (!$self.data('autoscroll') &&
        $elem.length &&
        location === currentLocation &&
        $('#chat-tabs').is(':visible') && $('#chat-tabs') &&
        isVisible($elem)){

        clearChatNotify(location);
        setTimeout(()=>{
            sendSeen(location);
        }, 2000);
    }
}

function clearNewMessagesOnFocus(e){
    const $self = $(this);
    const $chatContainer = $(`#chat-${currentLocation}-tab >> .chat-container`);
    const $elem = $chatContainer.find('.first-new');

    if ($elem.length &&
        $('#chat-tabs').is(':visible') && $('#chat-tabs') &&
        isVisible($elem)){

        clearChatNotify(currentLocation);
        setTimeout(()=>{
            sendSeen(currentLocation);
        }, 1000);
    }
}

function clearNewMessagesOnTab(){
    const $chatContainer = $(`#chat-${currentLocation}-tab >> .chat-container`);
    const $elem = $chatContainer.find('.first-new');

    if ($elem.length &&
        $('#chat-tabs').is(':visible') && $('#chat-tabs') &&
        isVisible($elem)){
        clearChatNotify(currentLocation);
        setTimeout(()=>{
            sendSeen(currentLocation);
        }, 1000);
    }
}

function showChatTab(e){
    const target = $(e.target).attr('aria-controls').match(/chat-(.+?)-tab/)[1];
    const $chatContainer = $(`#chat-${target}-tab >> .chat-container`);
    scrollSmoothToBottom($chatContainer, true);
    currentLocation = target;
    $('.chat-location').hide();
    if (target === 'report'){
        $('#chat-actions').hide();
    } else {
        $('#chat-actions').show();
    }
    clearNewMessagesOnTab();
    if (hideGamestateLocation && target === 'gamestate'){
        return;
    }
    $(`#chat-location-${target}`).show();

}

function sendSeen(location){
    const $chatContainer = $(`#chat-${location}-tab >> .chat-container`);
    const $message = $chatContainer.children().last();
    ws.send(JSON.stringify({
        action: 'chat',
        type: 'read',
        location: location,
        message_id: $message.data('messageid'),
    }));
    $chatContainer.find('.first-new').removeClass('first-new');
}

function isVisible($elem){
    const elementTop = $elem.offset().top;
    const elementBottom = elementTop + $elem.outerHeight();
    const $parent = $elem.parent();

    const containerTop = $parent.offset().top;
    const containerBottom = containerTop + $parent.outerHeight();

    return elementBottom > containerTop && elementTop < containerBottom;
}
