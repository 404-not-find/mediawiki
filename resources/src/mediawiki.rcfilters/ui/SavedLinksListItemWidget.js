/**
 * Quick links menu option widget
 *
 * @class mw.rcfilters.ui.SavedLinksListItemWidget
 * @extends OO.ui.Widget
 * @mixins OO.ui.mixin.IconElement
 *
 * @constructor
 * @param {mw.rcfilters.dm.SavedQueryItemModel} model View model
 * @param {Object} [config] Configuration object
 * @cfg {jQuery} [$overlay] A jQuery object serving as overlay for popups
 */
var SavedLinksListItemWidget = function MwRcfiltersUiSavedLinksListWidget( model, config ) {
	config = config || {};

	this.model = model;

	// Parent
	SavedLinksListItemWidget.parent.call( this, $.extend( {
		data: this.model.getID(),
		label: this.model.getLabel(),
		title: this.model.getLabel()
	}, config ) );

	// Mixin constructors
	OO.ui.mixin.IconElement.call( this, $.extend( {
		icon: ''
	}, config ) );

	this.edit = false;
	this.$overlay = config.$overlay || this.$element;

	this.popupButton = new OO.ui.ButtonWidget( {
		classes: [ 'mw-rcfilters-ui-savedLinksListItemWidget-button' ],
		icon: 'ellipsis',
		framed: false
	} );
	this.menu = new OO.ui.MenuSelectWidget( {
		classes: [ 'mw-rcfilters-ui-savedLinksListItemWidget-menu' ],
		widget: this.popupButton,
		width: 200,
		horizontalPosition: 'end',
		$floatableContainer: this.popupButton.$element,
		items: [
			new OO.ui.MenuOptionWidget( {
				data: 'edit',
				icon: 'edit',
				label: mw.msg( 'rcfilters-savedqueries-rename' )
			} ),
			new OO.ui.MenuOptionWidget( {
				data: 'delete',
				icon: 'trash',
				label: mw.msg( 'rcfilters-savedqueries-remove' )
			} ),
			new OO.ui.MenuOptionWidget( {
				data: 'default',
				icon: 'pushPin',
				label: mw.msg( 'rcfilters-savedqueries-setdefault' )
			} )
		]
	} );

	this.editInput = new OO.ui.TextInputWidget( {
		classes: [ 'mw-rcfilters-ui-savedLinksListItemWidget-input' ]
	} );
	this.saveButton = new OO.ui.ButtonWidget( {
		icon: 'check',
		flags: [ 'primary', 'progressive' ]
	} );
	this.toggleEdit( false );

	// Events
	this.model.connect( this, { update: 'onModelUpdate' } );
	this.popupButton.connect( this, { click: 'onPopupButtonClick' } );
	this.menu.connect( this, {
		choose: 'onMenuChoose'
	} );
	this.saveButton.connect( this, { click: 'save' } );
	this.editInput.connect( this, {
		change: 'onInputChange',
		enter: 'save'
	} );
	this.editInput.$input.on( {
		blur: this.onInputBlur.bind( this ),
		keyup: this.onInputKeyup.bind( this )
	} );
	this.$element.on( { click: this.onClick.bind( this ) } );
	this.$label.on( { click: this.onClick.bind( this ) } );
	this.$icon.on( { click: this.onDefaultIconClick.bind( this ) } );
	// Prevent propagation on mousedown for the save button
	// so the menu doesn't close
	this.saveButton.$element.on( { mousedown: function () {
		return false;
	} } );

	// Initialize
	this.toggleDefault( !!this.model.isDefault() );
	this.$overlay.append( this.menu.$element );
	// eslint-disable-next-line mediawiki/class-doc
	this.$element
		.addClass( 'mw-rcfilters-ui-savedLinksListItemWidget' )
		.addClass( 'mw-rcfilters-ui-savedLinksListItemWidget-query-' + this.model.getID() )
		.append(
			$( '<div>' )
				.addClass( 'mw-rcfilters-ui-table' )
				.append(
					$( '<div>' )
						.addClass( 'mw-rcfilters-ui-row' )
						.append(
							$( '<div>' )
								.addClass( 'mw-rcfilters-ui-cell' )
								.addClass( 'mw-rcfilters-ui-savedLinksListItemWidget-content' )
								.append(
									this.$label
										.addClass( 'mw-rcfilters-ui-savedLinksListItemWidget-label' ),
									this.editInput.$element,
									this.saveButton.$element
								),
							$( '<div>' )
								.addClass( 'mw-rcfilters-ui-cell' )
								.addClass( 'mw-rcfilters-ui-savedLinksListItemWidget-icon' )
								.append( this.$icon ),
							this.popupButton.$element
								.addClass( 'mw-rcfilters-ui-cell' )
						)
				)
		);
};

/* Initialization */
OO.inheritClass( SavedLinksListItemWidget, OO.ui.OptionWidget );
OO.mixinClass( SavedLinksListItemWidget, OO.ui.mixin.IconElement );

/* Events */

/**
 * @event delete
 *
 * The delete option was selected for this item
 */

/**
 * @event default
 * @param {boolean} default Item is default
 *
 * The 'make default' option was selected for this item
 */

/**
 * @event edit
 * @param {string} newLabel New label for the query
 *
 * The label has been edited
 */

/* Methods */

/**
 * Respond to model update event
 */
SavedLinksListItemWidget.prototype.onModelUpdate = function () {
	this.setLabel( this.model.getLabel() );
	this.toggleDefault( this.model.isDefault() );
};

/**
 * Respond to click on the element or label
 *
 * @fires click
 */
SavedLinksListItemWidget.prototype.onClick = function () {
	if ( !this.editing ) {
		this.emit( 'click' );
	}
};

/**
 * Respond to click on the 'default' icon. Open the submenu where the
 * default state can be changed.
 *
 * @return {boolean} false
 */
SavedLinksListItemWidget.prototype.onDefaultIconClick = function () {
	this.menu.toggle();
	return false;
};

/**
 * Respond to popup button click event
 */
SavedLinksListItemWidget.prototype.onPopupButtonClick = function () {
	this.menu.toggle();
};

/**
 * Respond to menu choose event
 *
 * @param {OO.ui.MenuOptionWidget} item Chosen item
 * @fires delete
 * @fires default
 */
SavedLinksListItemWidget.prototype.onMenuChoose = function ( item ) {
	var action = item.getData();

	if ( action === 'edit' ) {
		this.toggleEdit( true );
	} else if ( action === 'delete' ) {
		this.emit( 'delete' );
	} else if ( action === 'default' ) {
		this.emit( 'default', !this.default );
	}
	// Reset selected
	this.menu.selectItem( null );
	// Close the menu
	this.menu.toggle( false );
};

/**
 * Respond to input keyup event, this is the way to intercept 'escape' key
 *
 * @param {jQuery.Event} e Event data
 * @return {boolean} false
 */
SavedLinksListItemWidget.prototype.onInputKeyup = function ( e ) {
	if ( e.which === OO.ui.Keys.ESCAPE ) {
		// Return the input to the original label
		this.editInput.setValue( this.getLabel() );
		this.toggleEdit( false );
		return false;
	}
};

/**
 * Respond to blur event on the input
 */
SavedLinksListItemWidget.prototype.onInputBlur = function () {
	this.save();

	// Whether the save succeeded or not, the input-blur event
	// means we need to cancel editing mode
	this.toggleEdit( false );
};

/**
 * Respond to input change event
 *
 * @param {string} value Input value
 */
SavedLinksListItemWidget.prototype.onInputChange = function ( value ) {
	value = value.trim();

	this.saveButton.setDisabled( !value );
};

/**
 * Save the name of the query
 *
 * @fires edit
 */
SavedLinksListItemWidget.prototype.save = function () {
	var value = this.editInput.getValue().trim();

	if ( value ) {
		this.emit( 'edit', value );
		this.toggleEdit( false );
	}
};

/**
 * Toggle edit mode on this widget
 *
 * @param {boolean} isEdit Widget is in edit mode
 */
SavedLinksListItemWidget.prototype.toggleEdit = function ( isEdit ) {
	isEdit = isEdit === undefined ? !this.editing : isEdit;

	if ( this.editing !== isEdit ) {
		this.$element.toggleClass( 'mw-rcfilters-ui-savedLinksListItemWidget-edit', isEdit );
		this.editInput.setValue( this.getLabel() );

		this.editInput.toggle( isEdit );
		this.$label.toggleClass( 'oo-ui-element-hidden', isEdit );
		this.$icon.toggleClass( 'oo-ui-element-hidden', isEdit );
		this.popupButton.toggle( !isEdit );
		this.saveButton.toggle( isEdit );

		if ( isEdit ) {
			this.editInput.$input.trigger( 'focus' );
		}
		this.editing = isEdit;
	}
};

/**
 * Toggle default this widget
 *
 * @param {boolean} isDefault This item is default
 */
SavedLinksListItemWidget.prototype.toggleDefault = function ( isDefault ) {
	isDefault = isDefault === undefined ? !this.default : isDefault;

	if ( this.default !== isDefault ) {
		this.default = isDefault;
		this.setIcon( this.default ? 'pushPin' : '' );
		this.menu.findItemFromData( 'default' ).setLabel(
			this.default ?
				mw.msg( 'rcfilters-savedqueries-unsetdefault' ) :
				mw.msg( 'rcfilters-savedqueries-setdefault' )
		);
	}
};

/**
 * Get item ID
 *
 * @return {string} Query identifier
 */
SavedLinksListItemWidget.prototype.getID = function () {
	return this.model.getID();
};

module.exports = SavedLinksListItemWidget;
