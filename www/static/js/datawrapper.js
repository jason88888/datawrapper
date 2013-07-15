//      Datawrapper
(function(){

    // Initial Setup
    // -------------
    var root = this;

    // The top-level namespace. All public Backbone classes and modules will be
    // attached to this. Exported for both CommonJS and the browser.
    var Datawrapper;
    if (typeof exports !== 'undefined') {
        Datawrapper = exports;
    } else {
        Datawrapper = root.Datawrapper = { Parsers: {} };
    }

    // Datawrapper.Core
    // ----------------

    var Core = Datawrapper.Core = function() {
    };

    _.extend(Core, {

        initialize: function() {
            this.initLanguageLinks();
        },

        initLanguageLinks: function() {
            $('a[href|=#lang]').click(function(evt) {
                evt.preventDefault();
                $.ajax({
                    url: '/api/account/lang',
                    type: 'PUT',
                    data: JSON.stringify({ lang: $(evt.target).attr('href').substr(6) }),
                    processData: false,
                    success: function(data) {
                        location.reload();
                    }
                });
            });
        }

    });



}).call(this);(function(){

    // Datawrapper.Chart
    // -----------------

    //
    var Chart = Datawrapper.Chart = function(attributes) {
        this.__attributes = attributes;
    };

    _.extend(Chart.prototype, {

        get: function(key, _default) {
            var keys = key.split('.'),
                pt = this.__attributes;

            _.each(keys, function(key) {
                if (pt === undefined) {
                    return _default;
                }
                pt = pt[key];
            });
            return _.isUndefined(pt) || _.isNull(pt) ? _default : pt;
        },

        // loads the dataset of this chart
        dataset: function(callback, ignoreTranspose) {
            var datasource, me = this;

            datasource = dw.datasource.delimited({
                url: 'data',
                transpose: ignoreTranspose ? false : this.get('metadata.data.transpose', false)
            });

            return datasource.dataset().done(function(ds) {
                me.__dataset = ds;
                if ($.isFunction(callback)) callback(ds);
                if (me.__datasetLoadedCallbacks) {
                    $.each(me.__datasetLoadedCallbacks, function(i, f) {
                        if ($.isFunction(f)) f(me);
                    });
                }
            });

            /***

            var me = this, ds, dsOpts = {
                delimiter: 'auto',
                url: 'data',
                transpose: ignoreTranspose ? false : this.get('metadata.data.transpose', false),
                firstRowIsHeader: this.get('metadata.data.horizontal-header', true),
                firstColumnIsHeader: this.get('metadata.data.vertical-header', true)
            };
            me.__dataset = ds = new Datawrapper.Dataset(dsOpts);
            ds.fetch({
                success: function() {
                    callback(ds);
                    if (me.__datasetLoadedCallbacks) {
                        for (var i=0; i<me.__datasetLoadedCallbacks.length; i++) {
                            me.__datasetLoadedCallbacks[i](me);
                        }
                    }
                }
            });
            return ds;

            ***/
        },

        rawData: function(rawData) {
            var me = this,
                dsOpts = {
                    rawData: rawData,
                    delimiter: 'auto',
                    transpose: this.get('metadata.data.transpose', false),
                    firstRowIsHeader: this.get('metadata.data.horizontal-header', true),
                    firstColumnIsHeader: this.get('metadata.data.vertical-header', true)
                };
            me.__dataset = ds = new Datawrapper.Dataset(dsOpts);
            ds.fetchRaw();
        },

        datasetLoaded: function(callback) {
            var me = this;
            if (me.__dataset && me.__dataset.__loaded) {
                // run now
                callback(me);
            } else {
                if (!me.__datasetLoadedCallbacks) me.__datasetLoadedCallbacks = [];
                me.__datasetLoadedCallbacks.push(callback);
            }
        },

        dataSeries: function(sortByFirstValue, reverseOrder) {
            var me = this;
            ds = [];
            me.__dataset.eachSeries(function(series, i) {
                ds.push(series);
            });
            if (sortByFirstValue === true) {
                ds = ds.sort(function(a,b) {
                    return b.val(0) > a.val(0) ? 1 : -1;
                });
            } else if ($.type(sortByFirstValue) == "number") {
                var row = sortByFirstValue;
                ds = ds.sort(function(a,b) {
                    return b.val(row, true) > a.val(row, true) ? 1 : -1;
                });
            }
            if (reverseOrder) ds.reverse();
            return ds;
        },

        seriesByName: function(name) {
            return this.__dataset.column(name);
        },

        numRows: function() {
            return this.__dataset.numRows();
        },

        // column header is the first value of each data series
        hasColHeader:  function(invert) {
            var t = this.get('metadata.data.transpose');
            if (invert ? !t : t) {
                return this.get('metadata.data.vertical-header');
            } else {
                return this.get('metadata.data.horizontal-header');
            }
        },

        // row header is the first data series
        hasRowHeader: function() {
            return this.hasColHeader(true);
        },

        rowHeader: function() {
            var ds = this.__dataset;
            return this.hasRowHeader() ? { data: ds.rowNames() } : false;
        },

        rowLabels: function() {
            //console.warn('chart.rowLabels() is marked deprecated. Use chart.dataset().rowNames() instead');
            if (this.hasRowHeader()) {
                return this.rowHeader().data;
            } else {
                var rh = [];
                for (var i=0; i<this.numRows(); i++) rh.push('Row '+(i+1));
                return rh;
            }
        },

        rowLabel: function(r) {
            if (this.hasRowHeader()) {
                return this.rowHeader().data[r];
            } else {
                return r;
            }
        },

        hasHighlight: function() {
            var hl = this.get('metadata.visualize.highlighted-series');
            return _.isArray(hl) && hl.length > 0;
        },

        isHighlighted: function(col) {
            if (col === undefined) return false;
            var hl = this.get('metadata.visualize.highlighted-series');
            return !_.isArray(hl) || hl.length === 0 || _.indexOf(hl, col.name()) >= 0;
        },

        setLocale: function(locale, metric_prefix) {
            Globalize.culture(locale);
            this.locale = locale;
            this.metric_prefix = metric_prefix;
        },

        formatValue: function(val, full, round) {
            var me = this,
                format = me.get('metadata.describe.number-format'),
                div = Number(me.get('metadata.describe.number-divisor')),
                append = me.get('metadata.describe.number-append', '').replace(' ', '&nbsp;'),
                prepend = me.get('metadata.describe.number-prepend', '').replace(' ', '&nbsp;');

            if (div !== 0) val = Number(val) / Math.pow(10, div);
            if (format != '-') {
                if (round || val == Math.round(val)) format = format.substr(0,1)+'0';
                val = Globalize.format(val, format);
            } else if (div !== 0) {
                val = val.toFixed(1);
            }

            return full ? prepend + val + append : val;
        },

        /*
         * filter to a single row in the dataset
         */
        filterRow: function(row) {
            this.__dataset.filterRows([row]);
        },

        filterRows: function(rows) {
            this.__dataset.filterRows(rows);
        },

        hasMissingValues: function() {
            var missValues = false;
            _.each(this.dataSeries(), function(ds) {
                _.each(ds.data, function(val) {
                    if (val != Number(val)) {
                        missValues = true;
                        return false;
                    }
                });
                if (missValues) return false;
            });
            return missValues;
        }

    });

}).call(this);(function(){

    // Datawrapper.Theme
    // -----------------

    // Every theme will inherit the properties of this
    // theme. They can override everything or just a bit
    // of them. Also, every theme can extend any other
    // existing theme.

    Datawrapper.Themes = {};

    Datawrapper.Themes.Base = {

        /*
         * colors used in the theme
         */
        colors: {
            palette: ['#6E7DA1', '#64A4C4', '#53CCDD',  '#4EF4E8'],
            secondary: ["#000000", '#777777', '#cccccc', '#ffd500', '#6FAA12'],

            positive: '#85B4D4',
            negative: '#E31A1C',
            // colors background and text needs to be set in CSS as well!
            background: '#ffffff',
            text: '#000000'
        },

        /*
         * padding around the chart area
         */
        padding: {
            left: 0,
            right: 20,
            bottom: 30,
            top: 10
        },

        /*
         * custom properties for line charts
         */
        lineChart: {
            // stroke width used for lines, in px
            strokeWidth: 3,
            // the maximum width of direct labels, in px
            maxLabelWidth: 80,
            // the opacity used for fills between two lines
            fillOpacity: 0.2,
            // distance between labels and x-axis
            xLabelOffset: 20
        },

        /*
         * custom properties for column charts
         */
        columnChart: {
            // if set to true, the horizontal grid lines are cut
            // so that they don't overlap with the grid label.
            cutGridLines: false,
            // you can customize bar attributes
            barAttrs: {
                'stroke-width': 1
            }
        },

        /*
         * custom properties for bar charts
         */
        barChart: {
            // you can customize bar attributes
            barAttrs: {
                'stroke-width': 1
            }
        },

        /*
         * attributes of x axis, if there is any
         */
        xAxis: {
            stroke: '#333'
        },

        /*
         * attributes of y-axis if there is any shown
         */
        yAxis: {
            strokeWidth: 1
        },


        /*
         * attributes applied to horizontal grids if displayed
         * e.g. in line charts, column charts, ...
         *
         * you can use any property that makes sense on lines
         * such as stroke, strokeWidth, strokeDasharray,
         * strokeOpacity, etc.
         */
        horizontalGrid: {
            stroke: '#d9d9d9'
        },

        /*
         * just like horizontalGrid. used in line charts only so far
         *
         * you can define the grid line attributes here, e.g.
         * verticalGrid: { stroke: 'black', strokeOpacity: 0.4 }
         */
        verticalGrid: false,

        /*
         * draw a frame around the chart area (only in line chart)
         *
         * you can define the frame attributes here, e.g.
         * frame: { fill: 'white', stroke: 'black' }
         */
        frame: false,

        /*
         * if set to true, the frame border is drawn separately above
         * the other chart elements
         */
        frameStrokeOnTop: false,

        /*
         * probably deprecated
         */
        yTicks: false,


        hover: true,
        tooltip: true,

        hpadding: 0,
        vpadding: 10,

        /*
         * some chart types (line chart) go into a 'compact'
         * mode if the chart width is below this value
         */
        minWidth: 400,

        /*
         * theme locale, probably unused
         */
        locale: 'de_DE',

        /*
         * duration for animated transitions (ms)
         */
        duration: 1000,

        /*
         * easing for animated transitions
         */
         easing: 'expoInOut'

    };

}).call(this);(function(){

    // Datawrapper.Visualization.Base
    // ------------------------------

    // Every visualization should extend this class.
    // It provides the basic API between the chart template
    // page and the visualization class.

    Datawrapper.Visualizations = {
        Base: (function() {}).prototype
    };

    _.extend(Datawrapper.Visualizations.Base, {

        render: function(el) {
            $(el).html('implement me!');
        },

        setTheme: function(theme) {
            this.theme = theme;
            var attr_properties = ['horizontalGrid', 'verticalGrid', 'yAxis', 'xAxis'];
            _.each(attr_properties, function(prop) {
                // convert camel-case to dashes
                if (theme.hasOwnProperty(prop)) {
                    for (var key in theme[prop]) {
                        // dasherize
                        var lkey = key.replace(/([A-Z])/g, "-$1").toLowerCase();
                        if (!theme[prop].hasOwnProperty(lkey)) {
                            theme[prop][lkey] = theme[prop][key];
                        }
                    }
                }
            });
            return this;
        },

        setSize: function(width, height) {
            var me = this;
            me.__w = width;
            me.__h = height;
            return me;
        },

        load: function(chart, callback) {
            var me = this;
            this.chart = chart;
            return chart.dataset().done(function(ds) {
                me.dataset = ds;
                me.dataset.filterSeries(chart.get('metadata.data.ignore-series', {}));
                callback.call(me, me);
            });
        },

        /**
         * short-cut for this.chart.get('metadata.visualizes.*')
         */
        get: function(str, _default) {
            return this.chart.get('metadata.visualize.'+str, _default);
        },

        warn: function(str) {
            var warning = $('<div>' + str + '</div>');
            warning.css({
                'background-color': '#FCF8E3',
                'border': '1px solid #FBEED5',
                'border-radius': '4px 4px 4px 4px',
                'color': '#a07833',
                'margin-bottom': '18px',
                'padding': '8px 35px 8px 14px',
                'text-shadow': '0 1px 0 rgba(255, 255, 255, 0.5)',
                'left': '10%',
                'right': '10%',
                'z-index': 1000,
                'text-align': 'center',
                position: 'absolute'
            });
            $('body').prepend(warning);
            warning.hide();
            warning.fadeIn();
        },

        /**
         * returns a signature for this visualization which will be used
         * to test correct rendering of the chart in different browsers.
         * See raphael-chart.js for example implementation.
         */
        signature: function() {
            // nothing here, please overload
        },

        translate: function(str) {
            var locale = this.meta.locale, lang = this.lang;
            return locale[str] ? locale[str][lang] || locale[str] : str;
        },

        checkBrowserCompatibility: function(){
            return true;
        }

    });

}).call(this);