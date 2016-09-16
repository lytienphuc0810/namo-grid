! function($) {
    var searchOptionTemplate = '<option value="{{value}}">{{text}}</option>';
    var footerTemplate = '';
    footerTemplate += '<ul>';
    footerTemplate += '<li><a class="firstPage" href="#" data-page="first" title="">&laquo;</a></li>';
    footerTemplate += '<li><a class="previousPage" href="#" data-page="previous" title="">&lt;</a></li>';
    footerTemplate += '{{#pages}}<li><a class="{{#isOn}}on{{/isOn}}" href="#" data-page="{{pageNo}}" title="">{{pageNo}}</a></li>{{/pages}}';
    footerTemplate += '<li><a class="nextPage" href="#" data-page="next" title="">&gt;</a></li>';
    footerTemplate += '<li><a class="lastPage" href="#" data-page="last" title="">&raquo;</a></li>';
    footerTemplate += '</ul>';
    var rowTemplate = "<tr data-rowno={{rowno}}></tr>";
    var itemTemplate = '<td class="{{classes}}">{{value}}</td>';
    var defaultOption = {
        url: undefined,
        method: 'GET',
        hasInitData: false,
        data: [],
        state: {
            pageNumber: 1,
            pageSize: 10,
            searchField: "",
            searchText: "",
            sortName: "",
            sortOrder: "",
            total: 0
        },
        rowTemplate: rowTemplate,
        itemTemplate: itemTemplate,
        searchOptionTemplate: searchOptionTemplate,
        footerTemplate: footerTemplate,
        searchables: [],
        staticSearchField: undefined,
        columns: undefined,
        gridId: "#grid",
        gridBodyId: "#grid-body",
        headerId: "#grid-header",
        footerId: "#grid-footer",
        afterBodyRendered: function($body) {
            // body...
        },
        afterItemRendered: function($row, row, index, rows) {
            // body...
        },
        afterHeaderRendered: function($header) {
            // body...
        },
        afterFooterRendered: function() {
            // body...
        },
        afterInitialization: function() {}
    }

    var NeoGrid = function($element, options) {
        this.options = _.merge(_.cloneDeep(defaultOption), _.cloneDeep(options), function(a, b, key) {
            if (key === 'state') {
                return _.extend(a, b);
            }
        });

        this.$container = $element;
        this.$grid = this.$container.find(this.options.gridId);
        this.$header = this.$container.find(this.options.headerId);
        this.$footer = this.$container.find(this.options.footerId);

        // for faster template processing
        Mustache.parse(this.options.rowTemplate);
        Mustache.parse(this.options.itemTemplate);
        Mustache.parse(this.options.searchOptionTemplate);
        Mustache.parse(this.options.footerTemplate);

        var options = this.options;
        this.render().then(function() {
            options.afterInitialization();
        });
    };

    $.extend(NeoGrid.prototype, {
        $container: undefined,
        $grid: undefined,
        $header: undefined,
        $footer: undefined,
        option: undefined,
        isNotEmpty: function(str) {
            return str != undefined && str != "";
        },
        render: function() {
            var controller = this;
            controller.checkOptions();
            if (controller.isNotEmpty(controller.options.headerId)) {
                controller.renderHeader();
            }
            return controller.refreshGrid();
        },
        checkOptions: function() {
            var controller = this;
            var options = this.options;
            var requiredOptions = ["url", "columns"];

            _.each(requiredOptions, function(attr) {
                if (options[attr] == undefined) {
                    throw attr + " in options are not defined";
                }
            })
        },
        renderHeader: function() {
            var controller = this;
            var options = this.options
            var searchables = this.options.searchables;

            if (!options.staticSearchField) {
                var searchOptions = [];
                _.each(searchables, function(searchable, index) {
                    searchOptions.push(Mustache.render(options.searchOptionTemplate, {
                        text: searchable.name,
                        value: searchable.id
                    }));
                })
                controller.$header.find('select').append(searchOptions);
            }

            controller.initHeaderEvent();
            if (options.afterHeaderRendered !== undefined && _.isFunction(options.afterHeaderRendered)) {
                options.afterHeaderRendered(controller.$header);
            }
        },
        resetSearch: function() {
            var controller = this;

            var $input = controller.$header.find('input');
            $input.val('');

            if (!controller.options.staticSearchField) {
                var $select = controller.$header.find('select');
                $select.val('');
            }
        },
        initHeaderEvent: function() {
            var controller = this;
            var $select = controller.$header.find('select');
            var $input = controller.$header.find('input');

            controller.$header.find('form').submit(function(event) {
                controller.refreshGrid({
                    searchField: !controller.options.staticSearchField ? $select.val() : controller.options.staticSearchField,
                    searchText: $input.val(),
                    pageNumber: 1
                });
                controller.$grid.trigger("neogrid.search");
                event.preventDefault();
            })
        },
        refreshGrid: function(state) {
            var controller = this;
            var options = controller.options;
            return controller.renderBody(state).then(function() {
                options.afterBodyRendered();

                if (controller.isNotEmpty(controller.options.footerId)) {
                    controller.renderFooter();
                    controller.initFooterEvent();
                }
            });
        },
        renderBody: function(state) {
            var controller = this;
            var options = controller.options;
            options.state = _.extend(options.state, state);
            var state = options.state;

            if (options.hasInitData) {
                var deferred = $.Deferred();
                controller.renderRows(options.data);
                options.hasInitData = false;
                return deferred.resolve();
            } else {
                return $.ajax({
                    type: options.method,
                    url: options.url,
                    data: state,
                    success: function(data) {
                        controller.renderRows(data);
                    }
                });
            }
        },
        renderRows: function(data) {
            var controller = this;
            var options = controller.options;
            var state = options.state;
            state.total = data.total;
            var $gridBody = controller.$grid.find(options.gridBodyId).empty();
            controller.pageItemCount = data.rows.length;

            _.each(data.rows, function(row, index) {
                $gridBody.append(controller.renderItem(row, index, data.rows));
            });
        },
        renderItem: function(row, index, rows) {
            var controller = this;
            var options = controller.options;
            var state = options.state;

            var rowNo = controller.getRowNo(index);
            var $row = $(Mustache.render(options.rowTemplate, _.extend({
                rowno: rowNo
            }, row)));

            _.each(options.columns, function(column) {
                if (column.formatter !== undefined) {
                    if (controller.isNotEmpty(options.itemTemplate)) {
                        var rawCell = Mustache.render(options.itemTemplate, {
                            classes: column.classes
                        });
                        $(rawCell).append(column.formatter(row, rowNo, state, rows)).appendTo($row);
                    } else {
                        $(column.formatter(row, rowNo, state, rows)).appendTo($row);
                    }
                } else {
                    $row.append(Mustache.render(options.itemTemplate, {
                        value: row[column.id],
                        classes: column.classes
                    }));
                }
            })

            options.afterItemRendered($row, row, index, rows);
            return $row;
        },
        renderFooter: function() {
            var controller = this;
            var options = controller.options;
            var state = controller.options.state;
            var pages = [];
            var totalPage = controller.getTotalPage();
            controller.updatePagination();

            var getPageObject = function(i, pageNumber) {
                return {
                    pageNo: i,
                    isOn: i === pageNumber
                };
            }

            if (state.pageNumber <= 5) {
                // case of beginning
                for (var i = 1; i <= 10 && i <= totalPage; i++) {
                    var pageNo = i;
                    pages.push(getPageObject(pageNo, state.pageNumber));
                }
            } else if (state.pageNumber > totalPage - 5) {
                // case of ending
                for (var i = 0; i < 10 && totalPage - i >= 1; i++) {
                    var pageNo = totalPage - i;
                    pages.unshift(getPageObject(pageNo, state.pageNumber));
                }
            } else {
                // case of being between
                for (var i = -4; i <= 5; i++) {
                    var pageNo = state.pageNumber + i;
                    pages.push(getPageObject(pageNo, state.pageNumber));
                }
            }

            controller.$footer.empty().append(Mustache.render(options.footerTemplate, {
                pages: pages
            }));
        },
        initFooterEvent: function() {
            var controller = this;
            controller.$footer.find("a").click(function(event) {
                var $element = $(this);
                var pageNo = $element.data('page');
                switch (pageNo) {
                    case 'first':
                        pageNo = 1;
                        break;
                    case 'previous':
                        pageNo = controller.getPreviousPage();
                        break;
                    case 'next':
                        pageNo = controller.getNextPage();
                        break;
                    case 'last':
                        pageNo = controller.getTotalPage();
                        break;
                    default:
                        break
                }
                controller.refreshGrid({
                    pageNumber: pageNo
                });
                event.preventDefault();
            });
        },
        isLastPage: function() {
            var currentPage = this.options.state.pageNumber;
            var totalPage = this.getTotalPage();
            return currentPage === totalPage;
        },
        isFirstPage: function() {
            var currentPage = this.options.state.pageNumber;
            return currentPage === 1;
        },
        getPreviousPage: function() {
            var currentPage = this.options.state.pageNumber;
            var totalPage = this.getTotalPage();
            return currentPage - 1 >= 1 ? currentPage - 1 : 1;
        },
        getNextPage: function() {
            var currentPage = this.options.state.pageNumber;
            var totalPage = this.getTotalPage();
            return currentPage + 1 <= totalPage ? currentPage + 1 : totalPage;
        },
        getTotalPage: function() {
            var controller = this;
            var state = controller.options.state;
            if (state.total == 0) {
                return 1;
            } else {
                return Math.floor(state.total / state.pageSize) + (state.total % state.pageSize !== 0 ? 1 : 0)
            }
        },
        updatePagination: function() {
            var controller = this;
            var state = controller.options.state;
            var totalPage = controller.getTotalPage();
            if (state.pageNumber > totalPage) {
                state.pageNumber = totalPage;
            }
        },
        getRowNo: function(index) {
            return index + 1 + this.getOffset();
        },
        getOffset: function() {
            var controller = this;
            var state = controller.options.state;
            return (state.pageNumber - 1) * state.pageSize;
        }
    });

    $.fn.neoGrid = function(options) {
        var $element = $(this);
        var neoGrid = new NeoGrid($element, options);
        return neoGrid;
    }

}(jQuery);
