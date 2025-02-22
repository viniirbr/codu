import {
  parseCustomIframeUrl,
  youtubeRegex,
  codepenRegex,
  codesandboxRegex,
} from "../customPlugins/utils/customParseIframeUrl";
import { createYoutubeIframe } from "../customPlugins/mediaEmbed/components/Youtube";
import { createCodepenIframe } from "../customPlugins/mediaEmbed/components/Codepen";
import { createCodeSandboxIframe } from "../customPlugins/mediaEmbed/components/CodeSandbox";
import { createGenericIframe } from "../customPlugins/mediaEmbed/components/GenericIframe";
import { Element, Text } from "domhandler";

// Map Slate element names to HTML tag names
// Straightforward transform - no attributes are considered
// Use transforms instead for more complex operations
const ELEMENT_NAME_TAG_MAP = {
  p: "p",
  paragraph: "p",
  h1: "h1",
  h2: "h2",
  h3: "h3",
  h4: "h4",
  h5: "h5",
  h6: "h6",
  ul: "ul",
  ol: "ol",
  li: "li",
  blockquote: "blockquote",
};

const MARK_ELEMENT_TAG_MAP = {
  strikethrough: ["s"],
  bold: ["strong"],
  underline: ["u"],
  italic: ["i"],
  code_block: "pre",
  code_line: "code",
};

export const config = {
  markMap: MARK_ELEMENT_TAG_MAP,
  elementMap: ELEMENT_NAME_TAG_MAP,
  elementTransforms: {
    quote: ({ children = [] }) => {
      const p = [new domhandler_1.Element("p", {}, children)];
      return new domhandler_1.Element("blockquote", {}, p);
    },
    a: ({ node, children = [] }) => {
      const element = new domhandler_1.Element(
        "a",
        {
          href: node.url,
          target: "_blank",
        },
        children
      );
      return element;
    },
    code_block: ({ node, children = [] }) => {
      // Check for language and add default if none is specified
      const language = node.lang ? `language-${node.lang}` : "language-none";
      const preElement = new domhandler_1.Element(
        "pre",
        { class: language },
        children
      );
      return preElement;
    },
    code_line: ({ node }) => {
      // Extract the text from all child nodes that have a 'text' property
      const text = node.children
        .filter((child) => child.text)
        .map((child) => child.text)
        .join("");
      console.log(text);
      const codeElement = new domhandler_1.Element("code", { class: "block" }, [
        new domhandler_1.Text(text),
      ]);

      return codeElement;
    },
    media_embed: ({ node }) => {
      const processedUrl = parseCustomIframeUrl(node.url);
      if (processedUrl.match(youtubeRegex)) {
        return createYoutubeIframe(processedUrl);
      } else if (processedUrl.match(codepenRegex)) {
        return createCodepenIframe(processedUrl);
      } else if (processedUrl.match(codesandboxRegex)) {
        return createCodeSandboxIframe(processedUrl);
      } else {
        return createGenericIframe(processedUrl)
      }
    },

    img: ({ node }) => {
      const baseAttrs = {
        src: node.url,
      };

      if (node.width) {
        baseAttrs.width = `${node.width}`;
      }

      // If a caption is present, create a figure with an img and figcaption inside
      if (node.caption) {
        const imgElement = new domhandler_1.Element("img", baseAttrs);

        const figCaptionElement = new domhandler_1.Element(
          "figcaption",
          { class: "text-center" },
          [new domhandler_1.Text(node.caption[0].text)]
        );

        const figureElement = new domhandler_1.Element(
          "figure",
          { class: "flex flex-col items-center" },
          [imgElement, figCaptionElement]
        );

        return figureElement;
      }

      // Otherwise, just create an img
      else {
        return new domhandler_1.Element("img", baseAttrs);
      }
    },
  },
  encodeEntities: true,
  alwaysEncodeBreakingEntities: false,
  alwaysEncodeCodeEntities: false,
  convertLineBreakToBr: false,
};
