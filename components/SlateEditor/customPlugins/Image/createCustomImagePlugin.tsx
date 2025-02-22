import { Transforms, Path } from "slate";
import { createPluginFactory, getLastChildPath } from "@udecode/plate-common";
import {
  ImagePlugin,
  ELEMENT_IMAGE,
  getOnKeyDownCaption,
} from "@udecode/plate";

const withCustomImage = (editor: any) => {
  const { apply } = editor;

  editor.apply = (operation: any) => {
    apply(operation);

    if (
      operation.type === "insert_node" &&
      operation.node.type === ELEMENT_IMAGE
    ) {
      const emptyNode = { type: "p", children: [{ text: "" }] };
      const lastChildPath = getLastChildPath([editor, []]);

      if (lastChildPath) {
        Transforms.insertNodes(editor, emptyNode, {
          at: Path.next(lastChildPath),
        });
      } else {
        // Fallback if no child node is found
        Transforms.insertNodes(editor, emptyNode);
      }
    }
  };

  return editor;
};

export const createCustomImagePlugin = createPluginFactory<ImagePlugin>({
  key: ELEMENT_IMAGE,
  isElement: true,
  isVoid: true,
  withOverrides: withCustomImage,
  handlers: {
    onKeyDown: getOnKeyDownCaption(ELEMENT_IMAGE),
  },
  then: (editor, { type }) => ({
    deserializeHtml: {
      rules: [
        {
          validNodeName: "IMG",
        },
      ],
      getNode: (el) => ({
        type,
        url: el.getAttribute("src"),
      }),
    },
  }),
});
