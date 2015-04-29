treeview = function() {
    Function.prototype.inheritsFrom = function(parentClassOrObject ){
        if ( parentClassOrObject.constructor == Function )
        {
            //Normal Inheritance
            this.prototype = new parentClassOrObject;
            this.prototype.constructor = this;
            this.prototype.parent = parentClassOrObject.prototype;
        }
        else
        {
            //Pure Virtual Inheritance
            this.prototype = parentClassOrObject;
            this.prototype.constructor = this;
            this.prototype.parent = parentClassOrObject;
        }
        return this;
    }

    var Subscribers = function(){
        this.handlers = {};
    };
    Subscribers.prototype.on =function(eventName,handler){
        var handle = this.handlers[eventName];
        if(!handle){
            handle = $.Callbacks('unique');
            this.handlers[eventName] = handle;
        }
        handle.add(handler);
        return this;
    };
    Subscribers.prototype.off =function(eventName,handler){
        var handle = this.handlers[eventName];
        if(handle==null) return;
        if(handler==null){
            handle.empty();
            return;
        }
        handle.remove(handler);
    };
    Subscribers.prototype.fire =function(eventName,args){
        var handle = this.handlers[eventName];
        if(handle==null) return;
        handle.fireWith(this,[args]);
    };



    var CompositeNode = function(){
        this.parent = null;
        this.children = [];
        Subscribers.call(this);
    };
    CompositeNode.inheritsFrom(Subscribers);
    CompositeNode.prototype.getParent =function(){
        return this.parent;
    };
    CompositeNode.prototype.getChildren =function(){
        return this.children;
    };
    CompositeNode.prototype.remove =function(child){
        var index = $.inArray(child,this.children);
        if(index===-1)return;
        this.children.splice(index,1);
        child.parent = null;
        var args = {'child':child};
        this.fire('childRemoved',args);
    };
    CompositeNode.prototype.clear =function(){
        for(var i=0;i<this.children.length;i++){
            this.children[i].parent=null;
        }
        this.children.length=0;
        this.fire('childrenCleared');
    };
    CompositeNode.prototype.at =function(index){
        return this.children[index];
    };
    CompositeNode.prototype.add =function(child,options){
        if(child ==undefined)return;
        var defaults = {
            'silent':false
        };
        options = $.extend(defaults,options);
        var suppress = options['silent'];
        if($.isArray(child)){
            for(var i=0;i<child.length;i++){
                this.add(child[i],{'silent':true});
            }
            var args = {'children':child};
            this.fire('childrenAdded',args);
            return;
        }
        if(!(child instanceof CompositeNode))
            throw "expect CompositeNode";
        child.parent = this;
        this.children.push(child);
        if(!suppress) {
            var args = {'children': [child]};
            this.fire('childrenAdded', args);
        }
    };
    CompositeNode.prototype.getParent =function(){
        return this.parent;
    };

    function updateParents(options){
        for(var name in options){
            if(options[name] instanceof BaseNode){
                options[name].parent = this;
            }
        }
    }

    var BaseNode = function(options){
        var defaults = {};
        var options = $.extend(defaults,options);
        var children = options['children'];
        delete options['children'];
        this.changes = {};
        this.options = options;
        updateParents(this.options);
        CompositeNode.call(this,options);
        this.add(children);
    };
    BaseNode.inheritsFrom(CompositeNode);
    BaseNode.prototype.get =function(option){
        return this.options[option];
    };
    BaseNode.prototype.set =function(option,val,options){
        var defaults = {
            'silent':false
        };
        options = $.extend(defaults,options)

        var old = this.options[option];
        if(old===val)return;
        if(old instanceof BaseNode){
            old.parent = null;
        }
        if(val instanceof BaseNode)
            val.parent = this;

        var args = {'old':old,'new':val,'option':option};
        this.changes[option] = val;
        this.options[option] = val;
        if(!options['silent'])
            this.fire('settingChanged',args);
    };

    var TreeNode = function(options){
        this.states = new BaseNode({
            loading: false,
            opened: false,
            selected: false
        });
        this.states.parent = this;
        BaseNode.call(this, options);
    };
    TreeNode.inheritsFrom(BaseNode);
    TreeNode.prototype.setState=function(state,val){
        this.states.set(state,val,{'silent':true});
        var changedArgs = {'state': state, 'value': val};
        this.fire('stateChanged',changedArgs);
    };
    TreeNode.prototype.load = function(fn){
        this.setState('loading',true);
        var instance = this;
        fn(function(result){
            instance.setState('loading',false);
        });
    };
    TreeNode.prototype.toggleChildren = function(){
        this.setState('opened', !this.states.get('opened'));
    };
    TreeNode.prototype.getStates = function () {
        return this.states;
    };

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
                '<div class="node-loading"></div>',
                '<div class="node-children"></div>',
            '</div>',
        '</div>'
    ].join("");
    var _types = {};
    var _collapseIcon = 'glyphicon glyphicon-menu-down';
    var _expandIcon = 'glyphicon glyphicon-menu-right';
    var _loadingHtml = '<div class="spinner"><div class="bounce1"></div><div class="bounce2"></div><div class="bounce3"></div></div>';

    var NodeView = function(options){
        var defaults = {};
        options = $.extend(defaults,options);
        CompositeNode.call(this,options);
        this.$el = $('<div class="node-view"></div>').append(TEMPLATE);
        this._collapseBtn = this.$el.find('.node-collapse-icon .btn');
        this._displayTextDiv = this.$el.find('.node-display-text');
        this._loadingDiv = this.$el.find('.node-loading');
        this._childrenDiv = this.$el.find('.node-children:first');
        this._nodeBtn = this.$el.find('.node-text-btn:first');
        this.options = (options);
        if(options['model']==null){
            options['model'] = new TreeNode();
        }
        this.getModel().on('stateChanged',function(){
            this.updateState();
        }.bind(this));
        this.getModel().on('childrenAdded',function(){
           this.renderChildren();
        }.bind(this));
        this.getModel().on('childrenRemoved',function(){
            this.renderChildren();
        }.bind(this));
        this.getModel().on('childrenCleared',function(){
            this.destroyChildren();
        }.bind(this));
    };
    NodeView.inheritsFrom(CompositeNode);
    NodeView.prototype.getModel = function(){
        return this.options['model'];
    };
    NodeView.prototype.updateState=function(){
        this.renderLoadingIcon();
        this.renderCollapsibleIcon();
        this.renderSelection();
    };
    NodeView.prototype.destroy = function () {
        this.detachEvents();
        this.destroyChildren();
    };
    NodeView.prototype.detachEvents = function () {
        this._collapseBtn.off('click');
        this._nodeBtn.off('click');
    };
    NodeView.prototype.destroyChildren = function () {
        for (var i = 0; i <this.getChildren().length; i++) {
            this.at(i).destroy();
        }
        this.clear();
        this._childrenDiv.empty();
    };
    NodeView.prototype.empty = function () {
        this.destroyChildren();
    };
    NodeView.prototype.createChildNodeView = function (model) {
        return new NodeView({'model': model});
    };
    NodeView.prototype.renderText = function () {
        var text = this.getModel().get('text');
        this._displayTextDiv.html(text);
    };
    NodeView.prototype.attachEvents = function () {
        var model = this.getModel();
        this._collapseBtn.on('click', function () {
            model.toggleChildren();
        });
        this._nodeBtn.on('click', function () {
            this.onSelect({'selected': this});
        }.bind(this));
    };
    NodeView.prototype.onSelect =function(args){
        if(this.getParent()!=null){
            this.getParent().onSelect(args);
        }
    };
    NodeView.prototype.updateType=function(){
        var typeName = this.getModel().get('type');
        var type = _types[typeName];
        if(type==null)return;
    };
    NodeView.prototype.renderSelection = function () {
        var states = this.getModel().getStates();
        if (states.get('loading') === true) {
            this._loadingDiv.show();
            this._childrenDiv.hide();
            return;
        } else {
            this._loadingDiv.hide();
        }
    };
    NodeView.prototype.renderLoadingIcon = function () {
        var states = this.getModel().getStates();
        this._loadingDiv.html(_loadingHtml);
        if (states.get('loading') === true) {
            this._loadingDiv.show();
            this._childrenDiv.hide();
            return;
        } else {
            this._loadingDiv.hide();
        }
    };
    NodeView.prototype.renderCollapsibleIcon = function () {
        var model = this.getModel();
        if (model.get('isLeaf') === true) {
            this._collapseBtn.hide();
            this._childrenDiv.hide();
            return;
        }

        var states = model.getStates();
        if (states.get('opened') === true) {
            this._collapseBtn.find('i').removeClass(_expandIcon).addClass(_collapseIcon);
            this._childrenDiv.show();
        } else {
            this._collapseBtn.find('i').removeClass(_collapseIcon).addClass(_expandIcon);
            this._childrenDiv.hide();
        }
    };
    NodeView.prototype.setLoading = function(html){
        NodeView.setLoading(html);
    };
    NodeView.prototype.renderChildren = function () {
        this.destroyChildren();
        var model = this.getModel();
        var leaf = model.get('isLeaf');
        if (leaf === true) return;
        for (var i = 0; i < model.getChildren().length; i++) {
            var view = this.createChildNodeView(model.at(i));
            view.render();
            this._childrenDiv.append(view.$el);
            this.add(view);
        }
        if (this.getChildren().length == 0) {
            //this._childrenDiv.html('<span class="node-empty-text">(empty)</span>');
        }
    };
    NodeView.prototype.render = function () {
        this.renderText();
        this.renderChildren();
        this.updateState();
        this.attachEvents();
        this.updateType();
    };
    NodeView.addType = function(name,type){
        _types[name] = type;
    };
    NodeView.getType = function(name){
        return _types[name];
    };
    NodeView.setCollapseIconClass = function(icon){
        _collapseIcon = icon;
    };
    NodeView.setLoading = function(html){
        _loadingHtml = html;
    };
    NodeView.setExpandIconClass = function(icon){
        _expandIcon = icon;
    };

    var TreeView = function(options) {
        NodeView.call(this,options);
    };
    TreeView.inheritsFrom(NodeView);
    TreeView.prototype.onSelect = function(args) {
        this._selected = args['selected'];
        this.fire('nodeSelected',{'selected':this._selected});
    };

    return {
        TreeNode:TreeNode,
        NodeView:NodeView,
        TreeView:TreeView
    };
}();