$(function(){
    $('.player-advance-btn-confirm').hide();
    $('.player-advance-btn-cancel').hide();
    $('.player-advance-btn').on('click', showAdvanceConfirm);
    $('.player-advance-btn-confirm').on('click', advancePlayer);
    $('.player-advance-btn-cancel').on('click', cancelAdvance);

    $('.player-message-btn').tooltip();
    $('.player-viewdata-btn').tooltip();

    $('#toastModal').on('show.bs.modal', showToastModal);
    $('#toastModal').on('shown.bs.modal', (e) => {$('#toastText').focus();});
    $('#toastSend').on('click', sendToast);
    $('#dataModal').on('show.bs.modal', showDataModal);

});

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
    } else {
        location.reload();
    }
    $this.closest('td').find('.player-advance-btn').show();
    $this.closest('td').find('.player-advance-btn-cancel').hide();
    $this.hide();
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
