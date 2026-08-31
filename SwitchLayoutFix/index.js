(function(plugin,common,uiComponents){ "use strict";
const React=common.React;
const ReactNative=common.ReactNative;
const Forms=uiComponents.Forms;

let originalSwitchDescriptor=null;
let originalCreateElement=null;
let createElementWrapper=null;
let applied=false;

function onLoad(){
    if (ReactNative.Platform?.OS !== "ios") return;
    if (globalThis.__kettuSwitchLayoutFix) return;

    // 1) Fix plugins that render ReactNative.Switch directly.
    const descriptor = Object.getOwnPropertyDescriptor(ReactNative, "Switch");
    if (descriptor?.configurable) {
        const OriginalSwitch = ReactNative.Switch;
        const FixedSwitch = React.forwardRef(function(props, ref) {
            return React.createElement(OriginalSwitch, {
                ...props,
                ref,
                style: [
                    props?.style,
                    {
                        width: 63,
                        height: 28,
                        flexGrow: 0,
                        flexShrink: 0
                    }
                ]
            });
        });

        FixedSwitch.displayName = "SwitchLayoutFix";

        originalSwitchDescriptor = descriptor;

        Object.defineProperty(ReactNative, "Switch", {
            configurable: true,
            enumerable: descriptor.enumerable ?? true,
            writable: true,
            value: FixedSwitch
        });
    }

    // 2) Fix legacy plugin settings that use Forms.FormSwitchRow.
    // Some plugins capture FormSwitchRow when they load, so replacing the
    // exported component later is not enough. Intercept React elements instead.
    const TargetFormSwitchRow = Forms?.FormSwitchRow;
    const FormRow = Forms?.FormRow;

    if (TargetFormSwitchRow && FormRow) {
        originalCreateElement = React.createElement;

        function FixedFormSwitchRow(props) {
            return originalCreateElement(FormRow, {
                ...props,
                trailing: originalCreateElement(ReactNative.Switch, {
                    value: !!props?.value,
                    onValueChange: props?.onValueChange,
                    disabled: props?.disabled,
                    style: {
                        width: 63,
                        height: 28,
                        flexGrow: 0,
                        flexShrink: 0
                    }
                }),
                onPress: props?.disabled
                    ? undefined
                    : function() {
                        props?.onValueChange?.(!props?.value);
                    }
            });
        }

        createElementWrapper = function(type, props, ...children) {
            if (
                type === TargetFormSwitchRow ||
                type?.name === "FormSwitchRowContainer"
            ) {
                return originalCreateElement.call(
                    this,
                    FixedFormSwitchRow,
                    props,
                    ...children
                );
            }

            return originalCreateElement.call(
                this,
                type,
                props,
                ...children
            );
        };

        React.createElement = createElementWrapper;
    }

    globalThis.__kettuSwitchLayoutFix = {
        owner: "SwitchLayoutFix"
    };
    applied = true;
}

function onUnload(){
    if (!applied) return;

    if (
        originalCreateElement &&
        createElementWrapper &&
        React.createElement === createElementWrapper
    ) {
        React.createElement = originalCreateElement;
    }

    if (
        originalSwitchDescriptor &&
        globalThis.__kettuSwitchLayoutFix?.owner === "SwitchLayoutFix"
    ) {
        Object.defineProperty(
            ReactNative,
            "Switch",
            originalSwitchDescriptor
        );
    }

    if (globalThis.__kettuSwitchLayoutFix?.owner === "SwitchLayoutFix") {
        delete globalThis.__kettuSwitchLayoutFix;
    }

    originalSwitchDescriptor = null;
    originalCreateElement = null;
    createElementWrapper = null;
    applied = false;
}

plugin.onLoad = onLoad;
plugin.onUnload = onUnload;
return plugin;
})({}, vendetta.metro.common, vendetta.ui.components);
