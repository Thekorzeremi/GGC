/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import GObject from 'gi://GObject';
import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Dialog from 'resource:///org/gnome/shell/ui/dialog.js';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';

const NewCountdownDialog = GObject.registerClass(
class NewCountdownDialog extends ModalDialog.ModalDialog {
    _init(callback) {
        super._init();

        this.setButtons([
            {
                label: _('Annuler'),
                action: () => this.close(),
                key: Clutter.KEY_Escape,
            },
            {
                label: _('Ajouter'),
                action: () => {
                    const label = this._labelEntry.get_text();
                    const date = new Date(this._dateEntry.get_text());
                    if (label && !isNaN(date.getTime())) {
                        callback(label, date);
                        this.close();
                    }
                }
            },
        ]);

        let box = new St.BoxLayout({
            vertical: true,
            style: 'spacing: 12px',
        });

        let labelBox = new St.BoxLayout({
            style: 'spacing: 6px',
        });
        labelBox.add(new St.Label({text: _('Nom event :')}));
        this._labelEntry = new St.Entry({
            can_focus: true,
            style: 'width: 200px',
        });
        labelBox.add(this._labelEntry);
        box.add(labelBox);

        let dateBox = new St.BoxLayout({
            style: 'spacing: 6px',
        });
        dateBox.add(new St.Label({text: _('Date (YYYY-MM-DD):')}));
        this._dateEntry = new St.Entry({
            can_focus: true,
            style: 'width: 200px',
        });
        dateBox.add(this._dateEntry);
        box.add(dateBox);

        this.contentLayout.add(box);
    }
});

const Indicator = GObject.registerClass(
class Indicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, _('GGC - Gnome Genial Countdowns'));

        this._countdowns = new Map();
        this._settings = null;

        this.add_child(new St.Icon({
            icon_name: 'x-office-calendar-symbolic',
            style_class: 'system-status-icon',
        }));

        let addItem = new PopupMenu.PopupMenuItem(_('Ajouter un countdown'));
        addItem.connect('activate', () => this._showNewCountdownDialog());
        this.menu.addMenuItem(addItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._countdownsSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._countdownsSection);

        this._updateTimeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 60, () => {
            this._updateCountdowns();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _showNewCountdownDialog() {
        let dialog = new NewCountdownDialog((label, date) => {
            this._addCountdown(label, date);
        });
        dialog.open();
    }

    _addCountdown(label, date) {
        const id = Date.now().toString();
        this._countdowns.set(id, { label, date });
        this._updateCountdowns();
    }

    _updateCountdowns() {
        this._countdownsSection.removeAll();

        for (const [id, countdown] of this._countdowns.entries()) {
            const daysLeft = Math.ceil((countdown.date - new Date()) / (1000 * 60 * 60 * 24));
            const item = new PopupMenu.PopupMenuItem(
                `${countdown.label}: ${daysLeft} ${daysLeft === 1 ? _('day') : _('days')}`
            );

            const deleteIcon = new St.Icon({
                icon_name: 'edit-delete-symbolic',
                style_class: 'popup-menu-icon',
            });
            const deleteButton = new St.Button({
                child: deleteIcon,
                style_class: 'countdown-delete-button',
            });
            deleteButton.connect('clicked', () => {
                this._countdowns.delete(id);
                this._updateCountdowns();
            });
            item.add_child(deleteButton);
            item.add_style_pseudo_class('delete-button');

            this._countdownsSection.addMenuItem(item);
        }

        this.visible = true;
    }

    destroy() {
        if (this._updateTimeout) {
            GLib.source_remove(this._updateTimeout);
            this._updateTimeout = null;
        }
        super.destroy();
    }
});

export default class IndicatorExampleExtension extends Extension {
    enable() {
        this._indicator = new Indicator();
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        this._indicator.destroy();
        this._indicator = null;
    }
}
