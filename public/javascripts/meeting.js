$(function() {
    $('.start-jitsi-btn').confirmation({
        title: 'Start Jitsi Server?'
    }).on('click', startJitsiServer);

    $('#stop-jitsi-btn').confirmation({
        title: 'Stop Jitsi Server?'
    }).on('click', stopJitsiServer);

    $('[data-toggle="popover"]').popover({
        html:true,
        trigger:'hover',
        container: 'body',
        content: function() {
            var participants = $(this).data('participants');
            return participants.join('<br>');
        },
    });
});

async function startJitsiServer(e){
    e.preventDefault();
    const $this = $(this);
    const url = '/meeting/jitsi/start';
    const csrf = $this.attr('data-csrf');
    const result = await fetch(url, {
        method:'PUT',
        headers: {
            'csrf-token': csrf,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            videobridges: $(this).data('videobridges')
        })
    });
    location.reload();
}

async function stopJitsiServer(e){
    e.preventDefault();
    const $this = $(this);
    const url = '/meeting/jitsi/stop';
    const csrf = $this.attr('data-csrf');
    const result = await fetch(url, {
        method:'PUT',
        headers: {
            'csrf-token': csrf
        }
    });
    location.reload();
}
