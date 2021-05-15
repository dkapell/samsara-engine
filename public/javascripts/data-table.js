$(function(){
    const ordering = [];
    $('table.table-sorted').each(prepSortedTable);
    $('.table-sorted  tbody').on('click', '.clickable-row', clickRow);
    $('.table-sorted-loading').hide();
    $('#exportCSV').click(exportCSV);

    $('.table-sorted tbody').on('click', '.action-btn', function(e){
        e.stopPropagation();
    });
});

function prepSortedTable(){
    const $table = $(this);
    const ordering = [];
    const dataTable = $('.table-sorted').DataTable({
        paging: true,
        fixedHeader: true,
        stateSave: true,
        stateDuration: 0,
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
        drawCallback: function(){
            $table.find('.delete-btn').confirmation({
                title: 'Delete this item'
            }).on('click', deleteItem);
        }
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
    $table.show();
}

function clickRow(e){
    e.preventDefault();
    if ($(e.target).hasClass('dtr-expand')){
        return;
    }
    var object = $(this).attr('data-click-object');
    var id = $(this).attr('data-click-id');
    window.location.href='/'+ object + '/' + id;
}


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
