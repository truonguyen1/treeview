treeview = function() {
    var TreeNode = Backbone.Model.extend({
        initialize:function(){
            this.parent = null;
            this.children = new Backbone.Collection();
            this.states = {
                loading: false,
                opened: false,
                selected: false
            };
        },
        getParent:function(){
            return this.parent;
        },
        getChildren:function(){
            return this.children;
        },
        setState:function(state,val){
            this.states[state] = val;
            var changedArgs = {'originalEvent': 'stateChanged', 'src': this, 'data': {'state': state, 'value': val}};
            this.trigger('stateChanged',changedArgs);
        },
        toggleChildren : function(){
            this.setState('opened', !this.states['opened']);
        },
        getStates : function () {
            return this.states;
        },
        onSelect: function(args){
            if (this.getParent() != null && this.getParent().onSelect) {
                this.getParent().onSelect(args);
            }
        }

    });
    var TEMPLATE = [
        '<div class="node-header">',
        '<div class="node-header-left">',
        '<div class="node-collapse-icon"><button class="btn btn-link"><i class="fa fa-plus"></i></button></div>',
        '</div>',
        '<div class="node-header-middle">',
        '<button class="node-text-btn btn btn-link"><div class="node-display-text"></div></button>',
        '</div>',
        '</div>',
        '<div class="node-body">',
        '<div class="node-header-left"></div>',
        '<div class="node-header-middle">',
        '<div class="node-loading">Loading....</div>',
        '<div class="node-children"></div>',
        '</div>',
        '</div>'
    ].join("");
    var NodeView = Backbone.View.extend({
        className: "node-view",
        initialize:function(){
            this._childrenViews = [];
            var html = _.template(TEMPLATE)({});
            this.$el.html(html);
            this._collapseBtn = this.$el.find('.node-collapse-icon .btn');
            this._displayTextDiv = this.$el.find('.node-display-text');
            this._loadingDiv = this.$el.find('.node-loading');
            this._childrenDiv = this.$el.find('.node-children:first');
            this._nodeBtn = this.$el.find('.node-text-btn:first');
            if(this.model==null){
                this.model = new TreeNode();
            }
            this.model.on('stateChanged',function(){
                this.updateState();
            }.bind(this));
        },
        updateState:function(){
            this.renderLoadingIcon();
            this.renderCollapsibleIcon();
            this.renderSelection();
        },
        destroy : function () {
            this.detachEvents();
            this.destroyChildren();
        },
        detachEvents : function () {
            this._collapseBtn.off('click');
            this._nodeBtn.off('click');
        },
        destroyChildren : function () {
            for (var i = 0; i < this._childrenViews && this._childrenViews.length; i++) {
                this._childrenViews[i].destroy();
            }
            this._childrenViews.length = 0;
            this._childrenDiv.empty();
        },
        empty : function () {
            this.destroyChildren();
        },
        createChildNodeView : function (model) {
            return new NodeView({'model': model});
        },
        renderDisplayedText : function () {
            var text = this.model.get('displayedText');
            this._displayTextDiv.html(text);
        },
        attachEvents : function () {
            var model = this.model;
            this._collapseBtn.on('click', function () {
                model.toggleChildren();
            });
            this._nodeBtn.on('click', function () {
                model.onSelect({'src': model});
            });
        },
        renderSelection : function () {
            var states = this.model.getStates();
            if (states['loading'] === true) {
                this._loadingDiv.show();
                this._childrenDiv.hide();
                return;
            } else {
                this._loadingDiv.hide();
            }
        },
        renderLoadingIcon : function () {
            var states = this.model.getStates();
            if (states['loading'] === true) {
                this._loadingDiv.show();
                this._childrenDiv.hide();
                return;
            } else {
                this._loadingDiv.hide();
            }
        },
        renderCollapsibleIcon : function () {
            var model = this.model;
            if (model.get('isLeaf') === true) {
                this._collapseBtn.hide();
                this._childrenDiv.hide();
                return;
            }

            var states = model.getStates();
            if (states['opened'] === true) {
                this._collapseBtn.find('i').removeClass('fa-angle-right').addClass('fa-angle-down');
                this._childrenDiv.show();
            } else {
                this._collapseBtn.find('i').removeClass('fa-angle-down').addClass('fa-angle-right');
                this._childrenDiv.hide();
            }
        },
        renderChildren : function () {
            this.destroyChildren();
            var model = this.model;
            var children = model.getChildren();
            var leaf = model.get('isLeaf');
            if (leaf === true) return;
            for (var i = 0; i < children.length; i++) {
                var view = this.createChildNodeView(children.at(i));
                view.render();
                this._childrenDiv.append(view.$el);
                this._childrenViews.push(view);
            }
            if (this._childrenViews.length == 0) {
                this._childrenDiv.html('<span class="node-empty-text">(empty)</span>');
            }
        },
        render : function () {
            this.renderDisplayedText();
            this.renderChildren();
            this.updateState();
            this.attachEvents();
        }
    });
    var TreeView = NodeView.extend({
        onSelect:function(args){
            this._selected = args['src'];
        }
    });
    return {
        TreeNode:TreeNode,
        NodeView:NodeView,
        TreeView:TreeView
    };
}();