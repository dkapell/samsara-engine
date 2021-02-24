/* global _ gamestatebadgeTemplate triggerbuttonTemplate*/
$(function(){
    $('.player-advance-btn-confirm').hide();
    $('.player-advance-btn-cancel').hide();
    $('.player-advance-btn').on('click', showAdvanceConfirm);
    $('.player-advance-btn-confirm').on('click', advancePlayer);
    $('.player-advance-btn-cancel').on('click', cancelAdvance);
    $('.player-trigger-btn')
        .confirmation({title: 'Run Trigger?'})
        .on('click', runTrigger);

    $('.player-message-btn').tooltip();
    $('.player-viewdata-btn').tooltip();

    $('#toastModal').on('show.bs.modal', showToastModal);
    $('#toastModal').on('shown.bs.modal', (e) => {$('#toastText').focus();});
    $('#toastSend').on('click', sendToast);
    $('#dataModal').on('show.bs.modal', showDataModal);

});

async function refreshPlayerList(){
    const $table = $('#players-table');
    const runId = $table.data('runid');
    if (!runId){ return; }
    const url = `/run/${runId}?api=true`;
    const result = await fetch(url);
    const data = await result.json();
    $table.DataTable().rows().every(function(){
        var $row = this.nodes().toJQuery();
        const user = _.findWhere(data.users, {id: $row.data('userid')});

        let changed = false;
        //const $row = $table.find(`tr[data-userid=${user.id}]`);
        if (!$row[0]) { return; }
        // Group
        const $groupcol = $row.find('.col-player-groups');
        const grouptext = user.player.groups.length?_.pluck(user.player.groups, 'name').join(', '):null;
        if ($groupcol.html() !== grouptext){
            changed = true;
            $groupcol.html(grouptext);
        }
        // Name
        const $namecol = $row.find('.col-player-name');
        const nametext = user.name + ( user.connected?'<div class="badge badge-success ml-2">Connected</div>':'');
        if ($namecol.html() !== nametext){
            changed = true;
            $namecol.html(nametext);
        }

        // Character
        const $charactercol = $row.find('.col-player-character');
        if($charactercol.html() !== user.player.character){
            changed = true;
            $charactercol.html(user.player.character);
        }

        // Email
        const $emailcol = $row.find('.col-player-email');
        if($emailcol.html() !== user.email){
            changed = true;
            $emailcol.html(user.email);
        }

        // Gamestate
        const $gamestatecol = $row.find('.col-player-gamestate');
        const gamestateText = gamestatebadgeTemplate({user:user});
        if($gamestatecol.html() !== gamestateText){
            changed = true;
            $gamestatecol.html(gamestateText);
        }

        // Actions
        if (user.connected){
            $row.find('.player-message-btn').show();
        } else {
            $row.find('.player-message-btn').hide();
        }
        const $triggers = $row.find('.col-player-triggers');
        const currentTriggers = [];
        $triggers.find('.player-trigger-btn').each(function(){
            currentTriggers.push(Number($(this).data('triggerid')));
        });
        const newTriggers = _.pluck(user.triggers, 'id');
        if (!_.isEqual(currentTriggers, newTriggers)){
            const triggers = [];
            for (const trigger of user.triggers){
                if (!trigger.icon){ continue; }
                triggers.push(triggerbuttonTemplate({trigger:trigger, userId:user.id, full:false, csrfToken:data.csrfToken}));
            }
            $triggers.html(triggers.join(''));
            $triggers.find('.player-trigger-btn')
                .confirmation({title: 'Run Trigger?'})
                .on('click', runTrigger)
                .tooltip();

            changed = true;
        }

        $row.find('.player-viewdata-btn').data('userdata', user.player.data);

        if (changed){
            $table.DataTable().row($row).invalidate().draw();
        }
    });
}

async function advancePlayer(e){
    e.preventDefault();
    const $this = $(this);
    const url = $this.attr('url');
    const csrf = $this.attr('data-csrf');
    const result = await fetch(url, {
        method:'PUT',
        headers: {
            'csrf-token': csrf
        }
    });
    if($this.attr('data-back')){
        location = $this.attr('data-back');
    }
    $this.closest('td').find('.player-advance-btn').show();
    $this.closest('td').find('.player-advance-btn-cancel').hide();
    $this.hide();
}

async function runTrigger(e){
    e.preventDefault();
    const $this = $(this);
    const triggerId = $this.data('triggerid');
    const user = $this.data('user');
    let url = '';
    if (user === 'none'){
        return;
    } else if (user === 'all'){
        const runId = $this.data('run');
        url = `/run/${runId}/trigger/${triggerId}`;
    } else {
        url = `/player/${user}/trigger/${triggerId}`;
    }
    const csrf = $this.attr('data-csrf');
    const result = await fetch(url, {
        method:'PUT',
        headers: {
            'csrf-token': csrf
        }
    });
    if($this.attr('data-back')){
        location = $this.attr('data-back');
    }
}

function showAdvanceConfirm(e){
    e.preventDefault();
    const $this = $(this);
    $this.closest('td').find('.player-advance-btn-confirm').show();
    $this.closest('td').find('.player-advance-btn-cancel').show();
    $this.hide();
}

function cancelAdvance(e){
    e.preventDefault();
    const $this = $(this);
    $this.closest('td').find('.player-advance-btn').show();
    $this.closest('td').find('.player-advance-btn-confirm').hide();
    $this.hide();
}

function showToastModal(event){
    const $this = $(this);
    const $button = $(event.relatedTarget);
    const type = $button.data('type');
    if (type === 'user'){
        const userId = $button.data('user');
        const name = $button.data('name');
        $this.find('.modal-title').text(`Send message to ${name}`);
        $('#toastSend').attr('data-user', userId);
    } else {
        const runId = $button.data('run');
        $this.find('.modal-title').text('Send message to all players');
        $('#toastSend').attr('data-run', runId);
    }
    $('#toastSend').attr('data-type', type);
}

async function sendToast(e){
    e.preventDefault();
    const $this = $(this);

    const message = $('#toastText').val();

    const type = $this.data('type');
    let url = null;

    if (type === 'user'){
        const userId = $this.data('user');
        url = `/player/${userId}/toast`;
    } else {
        const runId = $this.data('run');
        url = `/run/${runId}/toast`;
    }

    const data = {
        from:  $('#toastFrom').val(),
        message:  $('#toastText').val(),
        duration: $('#toastAutohide').is(':checked') ? 30000 : 0
    };

    const result = await fetch(url, {
        method:'PUT',
        headers: {
            'csrf-token': $this.data('csrf'),
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });

    $('#toastText').val('');
    $('#toastModal').modal('hide');
}
function showDataModal(event){
    const $this = $(this);
    const $button = $(event.relatedTarget);
    const userId = $button.data('user');
    const name = $button.data('name');
    const data = JSON.stringify($button.data('userdata'), null, 2);
    $this.find('.modal-title').text(`View data for ${name}`);
    $this.find('.modal-body').text(data);
}
