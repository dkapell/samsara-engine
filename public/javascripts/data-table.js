$(function(){
    const ordering = [];
    const dataTable = $('.table-sorted').DataTable({
        paging: false,
        fixedHeader: true,
        saveState: true,
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

    dataTable.columns().every( function( i ) {
        var header = this.header();
        if ( $(header).is( '[data-order]' ) ) {
            var dataOrder = $(header).attr( 'data-order' );
            var theOrder = [ i, dataOrder ];
            ordering.push( theOrder );
        }
    });
    if( ordering.length > 0 ) {
        dataTable.order( ordering ).draw();
    }

    $('.clickable-row').on('click.data-table', function(e){
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
    $('.delete-btn').confirmation({
        title: 'Delete this item'
    }).on('click', deleteItem);

    $('.action-btn').on('click', function(e){
        e.stopPropagation();
    });
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

async function deleteItem(e){
    e.preventDefault();
    e.stopPropagation();
    const $this = $(this);
    const url = $this.attr('url');
    const result = await fetch(url, {method:'DELETE'});
    if($this.attr('data-back')){
        location = $this.attr('data-back');
    }
}
