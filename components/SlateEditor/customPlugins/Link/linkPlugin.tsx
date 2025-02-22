import {
  LinkPlugin,
  PlateFloatingLink,
  RenderAfterEditable,
} from "@udecode/plate";
import { MyPlatePlugin, MyValue } from "../../Editor/Settings/plateTypes";

export const linkPlugin: Partial<MyPlatePlugin<LinkPlugin>> = {
  renderAfterEditable: PlateFloatingLink as RenderAfterEditable<MyValue>,
};
