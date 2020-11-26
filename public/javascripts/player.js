$(function(){
    $('.player-advance-btn-confirm').hide();
    $('.player-advance-btn-cancel').hide();
    $('.player-advance-btn').on('click', showAdvanceConfirm);
    $('.player-advance-btn-confirm').on('click', advancePlayer);
    $('.player-advance-btn-cancel').on('click', cancelAdvance);
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
