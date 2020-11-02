$(function(){
    $('.table-sorted').DataTable({
        paging: false,
        fixedHeader: true,
        responsive: {
            details: {
                type: 'column'
            }
        },
        columnDefs: [ {
            className: 'dtr-control',
            orderable: false,
            targets:   0
        } ],
    });

    $('.clickable-row').on('click', function(e){
        e.preventDefault();
        if ($(e.target).hasClass('dtr-expand')){
            return;
        }
        var object = $(this).attr('data-click-object');
        var id = $(this).attr('data-click-id');
        window.location.href='/'+ object + '/' + id;
    });
    $('.table-sorted').show();
    $('.table-sorted-loading').hide();
    $('#exportCSV').click(exportCSV);
});

function exportCSV(e){
    var query = { export:true };
    if ($('#exportCSV').val()){
        query.search = $('#pager-search').val();
    }
    var url = window.location.href + '?' + $.param(query);
    e.preventDefault();
    window.open(url, '_self');
    $(this).blur();
}
