/* global _ */
$(function(){
    const ordering = [];
    $('table.table-sorted').each(prepSortedTable);
    $('table.table-filtered').each(prepFilteredTable);
    $('.table-sorted tbody').on('click', '.clickable-row', clickRow);
    $('.table-filtered tbody').on('click', '.clickable-row', clickRow);
    $('.table-sorted-loading').hide();
    $('#exportCSV').click(exportCSV);

    $('.table-sorted tbody').on('click', '.action-btn', function(e){
        e.stopPropagation();
    });
    $('.table-filtered tbody').on('click', '.action-btn', function(e){
        e.stopPropagation();
    });
    setTimeout( () => {
        makeColumnsResponsive();
    }, 10);
    $( window ).resize(function() {
        makeColumnsResponsive();
    });
});

function makeColumnsResponsive() {
    const visibleColumnCount = $('.table-filtered tbody tr:first-child td:visible').length;
    for (let i = 0; i <= $('.table-filtered thead tr:eq(1) th').length; i++) {
        const visibile = $(`.table-filtered thead tr:eq(0) th:eq(${i})`).is(':visible');
        if (visibile){
            $(`.table-filtered thead tr:eq(1) th:eq(${i})`).show();
        } else {
            $(`.table-filtered thead tr:eq(1) th:eq(${i})`).hide();
        }
    }
}

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
        lengthMenu: [ [10, 25, 50, 100, -1], [10, 25, 50, 100, 'All'] ],
        pageLength: 25,
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


function prepFilteredTable(){
    const $table = $(this);
    $table.find('thead tr').clone(true).appendTo( $table.find('thead'));
    const table = $table.DataTable({
        paging: true,
        scrollCollapse: true,
        stateSave: true,
        responsive: true,
        orderCellsTop: true,
        fixedHeader: true,
        lengthMenu: [ [10, 25, 50, 100, -1], [10, 25, 50, 100, 'All'] ],
        pageLength: 25,

        initComplete: function(){
            this.api().columns().every( function () {
                const column = this;
                if ($(column.header()).data('nofilter')){
                    $('.table-filtered thead tr:eq(1) th').eq(column.index()).empty();
                    return;
                }
                const title = $(column.header()).text();
                if (!title) { return; }

                const inputGroup = $('<div>')
                    .addClass('input-group')
                    .appendTo($('.table-filtered thead tr:eq(1) th').eq(column.index()).empty() );

                const select = $('<select>')
                    .addClass('custom-select')
                    .attr('data-placeholder', title)
                    .data('partialmatch', $(column.header()).data('partialmatch'))
                    .appendTo(inputGroup)
                    .on( 'change', function () {
                        let val = $.fn.dataTable.util.escapeRegex(
                            $(this).val()
                        );
                        if (!$(this).data('partialmatch') && val){
                            val = `^${val}$`;
                        }
                        column
                            .search( val ? val : '', true, false )
                            .draw();
                        if ($(this).val()){
                            clearBtn.show();
                        } else {
                            clearBtn.hide();
                        }
                        setTimeout(()=>{
                            $table.DataTable().columns.adjust().responsive.recalc();
                        }, 10);

                    })
                    .select2({
                        theme:'bootstrap4',
                        minimumResultsForSearch: 6,
                        width:'resolve',
                        dropdownCssClass: 'filterDropdown'
                    });
                addOptions(column);

                const inputGroupAppend = $('<div>').addClass('input-group-append').appendTo(inputGroup);

                const clearBtn = $('<button>')
                    .addClass('btn')
                    .addClass('btn-sm')
                    .addClass('btn-outline-light')
                    .append($('<i>').addClass('fa').addClass('fa-times-circle'))
                    .appendTo(inputGroupAppend)
                    .on('click', function(){
                        select.val(null).trigger('change');

                    });
                if (select.val()){
                    clearBtn.show();
                } else {
                    clearBtn.hide();
                }
            });
        },
        drawCallback: function(){
            $table.find('.delete-btn').confirmation({
                title: 'Delete this item'
            }).on('click', deleteItem);
            $table.find('[data-toggle="popover"]').popover({
                trigger: 'hover'
            });
            $table.find('[data-toggle="tooltip"]').tooltip({delay: { 'show': 500, 'hide': 100 }});
            this.api().columns().every( function () {
                addOptions(this);
            });
        }

    });

    $('.dataTables_filter').find('label').append($('<button>')
        .append($('<i>').addClass('fa').addClass('fa-times-circle').addClass('pr-2'))
        .append('Clear Filters')
        .addClass('float-right')
        .addClass('btn')
        .addClass('btn-sm')
        .addClass('ml-2')
        .addClass('btn-outline-light')
        .on('click', function(e){
            e.preventDefault();
            $('.table-filtered thead th select').each(function() {
                $(this).val(null).trigger('change');
            });
        })
    );
    setTimeout( () => {
        $('#tableLoading').hide();
        $table.show();
        $table.DataTable().columns.adjust().responsive.recalc();
        makeColumnsResponsive();
    }, 10);
}

function addOptions(column){
    const partialmatch = $(column.header()).data('partialmatch');
    const select = $('.table-filtered thead tr:eq(1) th').eq(column.index()).find('select');
    select
        .empty()
        .append($('<option>'));
    const values = [];
    column.nodes().each( function ( d, j ) {
        const data = $(d);

        const val = data.data('search')?data.data('search'):data.text();
        for (const str of val.split(/\s*,\s*/)){
            values.push(str);
        }
    });
    for (const val of _.uniq(values).sort()){
        if (partialmatch && column.search() ===  val ) {
            select.append($('<option>')
                .attr('value', val)
                .attr('selected', 'selected')
                .text(val.length>33?val.substr(0,30)+'...':val)
            );
        } else if (column.search() ===   `^${val}$`) {
            select.append($('<option>')
                .attr('value', val)
                .attr('selected', 'selected')
                .text(val.length>33?val.substr(0,30)+'...':val)
            );
        } else {
            select.append($('<option>')
                .attr('value', val)
                .text(val.length>33?val.substr(0,30)+'...':val)
            );
        }
    }

}

function clickRow(e){
    e.preventDefault();
    if ($(e.target).hasClass('dtr-control')){
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
