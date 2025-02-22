// THIS FILE IS FOR ALPHA CHANGES ONLY
import type { NextPage, GetServerSideProps } from "next";
import { ZodError } from "zod";
import { useRouter } from "next/router";
import React, { useState, useEffect, Fragment, useRef } from "react";
import { unstable_getServerSession } from "next-auth/next";
import { authOptions } from "../../api/auth/[...nextauth]";
import { useForm } from "react-hook-form";
import CustomTextareaAutosize from "../../../components/CustomTextareAutosize/CustomTextareaAutosize";
import toast, { Toaster } from "react-hot-toast";
import { Disclosure, Transition } from "@headlessui/react";
import { ChevronUpIcon } from "@heroicons/react/solid";

import type { SavePostInput } from "../../../schema/post";
import { ConfirmPostSchema } from "../../../schema/post";
import LayoutEditor from "../../../components/Layout/LayoutEditor";
import { PromptDialog } from "../../../components/PromptService/PromptService";
import EditorHints from "../../../components/EditorHints/EditorHints";

import { trpc } from "../../../utils/trpc";
import { useDebounce } from "../../../hooks/useDebounce";
import Markdoc from "@markdoc/markdoc";
import { useMarkdownHotkeys } from "../../../markdoc/editor/hotkeys/hotkeys.markdoc";
import { useMarkdownShortcuts } from "../../../markdoc/editor/shortcuts/shortcuts.markdoc";
import { markdocComponents } from "../../../markdoc/components";
import { config } from "../../../markdoc/config";

import IconEye from "../../../icons/icon-eye.svg";
import IconEyeShut from "../../../icons/icon-eye-shut.svg";

const Create: NextPage = () => {
  const router = useRouter();
  const { postIdArr } = router.query;

  const postId = postIdArr?.[0] || "";

  const [viewPreview, setViewPreview] = useState<boolean>(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagValue, setTagValue] = useState<string>("");
  const [savedTime, setSavedTime] = useState<string>("");
  const [open, setOpen] = useState<boolean>(false);
  const [shouldRefetch, setShouldRefetch] = useState<boolean>(true);
  const [unsavedChanges, setUnsavedChanges] = useState<boolean>(false);
  const [delayDebounce, setDelayDebounce] = useState<boolean>(false);
  const allowUpdate = unsavedChanges && !delayDebounce;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useMarkdownHotkeys(textareaRef);
  useMarkdownShortcuts(textareaRef);

  const {
    handleSubmit,
    register,
    watch,
    reset,
    getValues,
    formState: { isDirty },
  } = useForm<SavePostInput>({
    mode: "onSubmit",
    defaultValues: {
      title: "",
      body: "",
    },
  });

  const { title, body } = watch();

  const debouncedValue = useDebounce(title + body, 1500);

  const { mutate: publish, status: publishStatus } =
    trpc.post.publish.useMutation();

  const { mutate: save, status: saveStatus } = trpc.post.update.useMutation({
    onError() {
      // TODO: Add error messages from field validations
      return toast.error("Something went wrong auto-saving");
    },
    onSuccess() {
      setSavedTime(
        new Date().toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      );
    },
  });
  const { mutate: create, data: createData } = trpc.post.create.useMutation({
    onError() {
      toast.error("Something went wrong creating draft");
    },
    onSuccess() {
      toast.success("Saved draft");
    },
  });

  // TODO get rid of this for standard get post
  // Should be allowed get draft post through regular mechanism if you own it
  const { data, status: dataStatus } = trpc.post.editDraft.useQuery(
    { id: postId },
    {
      onError() {
        toast.error(
          "Something went wrong fetching your draft, refresh your page or you may lose data",
          {
            duration: 5000,
          }
        );
      },
      enabled: !!postId && shouldRefetch,
    }
  );

  useEffect(() => {
    if (shouldRefetch) {
      setShouldRefetch(!(dataStatus === "success"));
    }
  }, [dataStatus, shouldRefetch]);

  const getFormData = () => {
    const data = getValues();
    const formData = {
      ...data,
      tags,
      canonicalUrl: data.canonicalUrl || undefined,
      excerpt: data.excerpt || undefined,
    };
    return formData;
  };

  const savePost = async () => {
    const formData = getFormData();

    if (!formData.id) {
      create({ ...formData });
    } else {
      save({ ...formData, id: postId });
    }
    setUnsavedChanges(false);
  };

  const hasLoadingState =
    publishStatus === "loading" ||
    saveStatus === "loading" ||
    dataStatus === "loading";

  const published = !!data?.published || false;

  const onSubmit = async (data: SavePostInput) => {
    // vaidate markdoc syntax
    const ast = Markdoc.parse(data.body);
    const errors = Markdoc.validate(ast, config).filter(
      (e) => e.error.level === "critical"
    );

    if (errors.length > 0) {
      console.error(errors);
      errors.forEach((err) => {
        toast.error(err.error.message);
      });
      return;
    }
    if (!published) {
      try {
        const formData = getFormData();
        ConfirmPostSchema.parse(formData);
        await savePost();
        return await publish(
          { id: postId, published: !published },
          {
            onSuccess(response) {
              response?.slug && router.push(`/articles/${response.slug}`);
            },
            onError() {
              toast.error("Something went wrong publishing, please try again.");
            },
          }
        );
      } catch (err) {
        if (err instanceof ZodError) {
          return toast.error(err.issues[0].message);
        } else {
          return toast.error("Something went when trying to publish.");
        }
      }
    }
    await savePost();
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    const { value } = e.target;
    setTagValue(value);
  };

  const onDelete = (tag: string) => {
    setTags((t) => t.filter((t) => t !== tag));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const { key } = e;
    const trimmedInput = tagValue
      .trim()
      .toUpperCase()
      .replace(/[^\w\s]/gi, "");
    if (
      (key === "," || key === "." || key === "Enter") &&
      trimmedInput.length &&
      !tags.includes(trimmedInput)
    ) {
      e.preventDefault();
      setTags((prevState) => [...prevState, trimmedInput]);
      setTagValue("");
    }
  };

  useEffect(() => {
    if (!data) return;
    const { body, excerpt, title, id, tags } = data;
    setTags(tags.map(({ tag }) => tag.title));
    reset({ body, excerpt, title, id });
  }, [data]);

  useEffect(() => {
    if (published) return;
    if ((title + body).length < 5) return;
    if (debouncedValue === (data?.title || "") + data?.body) return;
    if (allowUpdate) savePost();
  }, [debouncedValue]);

  useEffect(() => {
    if (!createData?.id) return;
    router.push(createData.id);
  }, [createData]);

  const hasContent = title.length >= 5 && body.length >= 10;

  const isDisabled = hasLoadingState || !hasContent;

  useEffect(() => {
    if ((title + body).length < 5) return;
    if (isDirty) setUnsavedChanges(true);
  }, [title, body]);

  const handleOpenDialog = (res: string) => {
    switch (res) {
      case "initial":
        setDelayDebounce(true);
        break;
      case "confirm":
        setUnsavedChanges(false);
        setDelayDebounce(false);
        break;
      case "cancel":
        setDelayDebounce(false);
        !published && savePost();
        break;
      default:
        // setting allowUpdate in this case
        setDelayDebounce(false);
        setUnsavedChanges(true);
    }
  };

  return (
    <LayoutEditor>
      <div className="bg-smoke">
        <PromptDialog
          shouldConfirmLeave={unsavedChanges}
          updateParent={handleOpenDialog}
        />
        <form onSubmit={handleSubmit(onSubmit)}>
          <Transition.Root show={open} as={Fragment}>
            <div className="fixed left-0 bottom-0 top-0 w-full h-screen bg-smoke">
              <button
                type="button"
                className="absolute right-8 top-8 underline cursor-pointer z-50"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
              <div className="relative mx-4 flex flex-col justify-center items-center h-full overflow-y-auto">
                <div className="pt-16 pb-8">
                  <div className="block sm:grid gap-6 sm:grid-cols-12 w-full max-w-2xl">
                    <div className="sm:col-span-6 mt-8 sm:mt-0">
                      {" "}
                      <label htmlFor="excerpt">Excerpt</label>
                      <textarea
                        maxLength={156}
                        id="excerpt"
                        rows={3}
                        {...register("excerpt")}
                      />
                      <p className="mt-2 text-sm text-neutral-400">
                        What readers will see before they click on your article.
                        Good SEO descriptions utilize keywords, summarize the
                        story and are between 140-156 characters long.
                      </p>
                    </div>
                    <div className="sm:col-span-6 my-4 sm:my-0">
                      <label htmlFor="tags">Topics</label>
                      <input
                        id="tag"
                        name="tag"
                        disabled={tags.length >= 5}
                        placeholder={
                          tags.length >= 5
                            ? "Maximum 5 tags"
                            : "Comma seperated tags"
                        }
                        type="text"
                        onChange={(e) => onChange(e)}
                        value={tagValue}
                        onKeyDown={onKeyDown}
                      />
                      {tags.map((tag) => (
                        <div
                          key={tag}
                          className="bg-neutral-300 inline-flex items-center text-sm mt-2 mr-1 overflow-hidden"
                        >
                          <span
                            className="ml-2 mr-1 leading-relaxed truncate max-w-xs px-1 text-xs text-black font-semibold"
                            x-text="tag"
                          >
                            {tag}
                          </span>
                          <button
                            onClick={() => onDelete(tag)}
                            className="w-6 h-6 inline-block align-middle text-white bg-neutral-600 focus:outline-none"
                          >
                            <svg
                              className="w-6 h-6 fill-current mx-auto"
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                            >
                              <path
                                fillRule="evenodd"
                                d="M15.78 14.36a1 1 0 0 1-1.42 1.42l-2.82-2.83-2.83 2.83a1 1 0 1 1-1.42-1.42l2.83-2.82L7.3 8.7a1 1 0 0 1 1.42-1.42l2.83 2.83 2.82-2.83a1 1 0 0 1 1.42 1.42l-2.83 2.83 2.83 2.82z"
                              />
                            </svg>
                          </button>
                        </div>
                      ))}
                      <p className="mt-2 text-sm text-gray-400">
                        Tag with up to 5 topics. This makes it easier for
                        readers to find and know what your story is about.
                      </p>
                    </div>
                    <div className="col-span-12  border-b border-neutral-300 pb-4">
                      <Disclosure>
                        {({ open }) => (
                          <>
                            <Disclosure.Button className="flex w-full justify-between py-2 text-left text-sm font-medium text-white focus:outline-none focus-visible:ring focus-visible:ring-blue-500 focus-visible:ring-opacity-75">
                              <span>View advanced settings</span>
                              <ChevronUpIcon
                                className={`${
                                  open ? "rotate-180 transform" : ""
                                } h-5 w-5 text-neutral-400`}
                              />
                            </Disclosure.Button>
                            <Disclosure.Panel className="pt-4 pb-2">
                              <label htmlFor="canonicalUrl">
                                Canonical URL
                              </label>
                              <input
                                id="canonicalUrl"
                                type="text"
                                placeholder="https://www.somesite.com/i-posted-here-first"
                                defaultValue=""
                                {...register("canonicalUrl")}
                              />
                              <p className="mt-2 text-sm text-neutral-400">
                                Add this if the post was originally published
                                elsewhere and you want to link to it as the
                                original source.
                              </p>
                            </Disclosure.Panel>
                          </>
                        )}
                      </Disclosure>
                    </div>
                    <div className="mt-4 sm:mt-0 sm:col-span-12 flex justify-end w-full">
                      {!data?.published && (
                        <button
                          type="button"
                          disabled={isDisabled}
                          className="bg-white border border-neutral-300 shadow-sm py-2 px-4 inline-flex justify-center text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-300"
                          onClick={async () => {
                            if (isDisabled) return;
                            await savePost();
                            router.push("/my-posts?tab=drafts");
                          }}
                        >
                          Save Draft
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={isDisabled}
                        className="ml-5 bg-gradient-to-r from-orange-400 to-pink-600 shadow-sm py-2 px-4 inline-flex justify-center text-sm font-medium text-white hover:from-orange-300 hover:to-pink-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-300"
                      >
                        {hasLoadingState ? (
                          <>
                            <div className="mr-2 animate-spin h-5 w-5 border-2 border-orange-700 border-t-white rounded-full" />
                            {"Saving"}
                          </>
                        ) : (
                          <>
                            {!data?.published && "Publish"}
                            {data?.published && "Save Changes"}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  sadfasdf
                </div>
              </div>
            </div>
          </Transition.Root>
          <Toaster
            toastOptions={{
              style: {
                borderRadius: 0,
                border: "2px solid black",
                background: "white",
              },
            }}
          />
          {dataStatus === "loading" && postId && (
            <div className="fixed top-0 left-0 z-40 w-screen h-screen flex items-center justify-center bg-gray ">
              <div className="bg-white z-50 py-2 px-5 flex items-center flex-col border-2 border-black opacity-100">
                <div className="loader-dots block relative w-20 h-5 mt-2">
                  <div className="absolute top-0 mt-1 w-3 h-3 rounded-full bg-gradient-to-r from-orange-400 to-pink-600 shadow-sm"></div>
                  <div className="absolute top-0 mt-1 w-3 h-3 rounded-full bg-gradient-to-r from-orange-400 to-pink-600 shadow-sm"></div>
                  <div className="absolute top-0 mt-1 w-3 h-3 rounded-full bg-gradient-to-r from-orange-400 to-pink-600 shadow-sm"></div>
                  <div className="absolute top-0 mt-1 w-3 h-3 rounded-full bg-gradient-to-r from-orange-400 to-pink-600 shadow-sm"></div>
                </div>
                <div className="text-neutral-400 text-xs font-medium mt-2 text-center">
                  Fetching post data.
                </div>
              </div>
              <div className="absolute bg-black top-0 bottom-0 left-0 right-0 opacity-25 z-60" />
            </div>
          )}
          <div className="editor-actions bg-black sticky z-20 top-0 flex justify-end items-center py-4 lg:py-6 px-4 sm:px-6 g:px-4">
            <p className="mr-4">
              {saveStatus === "loading" && (
                <span className="text-gray-400 text-xs lg:text-sm">
                  Saving...
                </span>
              )}
              {saveStatus === "error" && savedTime && (
                <span className="text-red-600 text-xs lg:text-sm">
                  {`Error saving, last saved: ${savedTime.toString()}`}
                </span>
              )}
              {saveStatus === "success" && savedTime && (
                <span
                  className="text-gray-400 text-xs lg:text-sm"
                  title={savedTime.toString()}
                >
                  {`Saved`}
                </span>
              )}
            </p>

            <button
              type="button"
              title="Preview"
              className="py-2 px-3 mr-4 inline-flex justify-center focus:outline-none"
              onClick={() => setViewPreview((current) => !current)}
            >
              {viewPreview ? (
                <IconEyeShut
                  className="h-6 w-6 fill-slate-400"
                  aria-hidden="true"
                />
              ) : (
                <IconEye
                  className="h-6 w-6 fill-slate-700"
                  aria-hidden="true"
                />
              )}
            </button>

            <button
              type="button"
              disabled={isDisabled}
              className="disabled:opacity-50 py-2 px-3 bg-gradient-to-r from-orange-400 to-pink-600 shadow-sm  inline-flex justify-center text-sm font-medium text-white hover:from-orange-300 hover:to-pink-500 focus:outline-none"
              onClick={() => setOpen(true)}
            >
              {!data?.published && "Publish"}
              {data?.published && "Save Changes"}
            </button>
          </div>
          <div className="bg-smoke relative">
            <div className="flex-grow w-full max-w-7xl mx-auto xl:px-8 lg:flex text-black">
              {/* Left sidebar & main wrapper */}
              <div className="flex-1 min-w-0 xl:flex">
                <div className="lg:min-w-0 lg:flex-1">
                  <div className="h-full py-0 lg:py-6 px-4 sm:px-6 lg:px-4 ">
                    {/* Start main area*/}
                    <div className="relative h-full">
                      <div className="text-white border-white shadow-xl">
                        {viewPreview ? (
                          <section className="mx-auto pb-4 max-w-xl py-6 px-4 sm:p-6 lg:pb-8">
                            <h2 className="pt-4 sm:my-5 text-3xl font-bold leading-tight">
                              {title}
                            </h2>
                            <article
                              className="prose prose-invert"
                              style={{
                                whiteSpace: "pre-wrap",
                                overflowWrap: "anywhere",
                              }}
                            >
                              {Markdoc.renderers.react(
                                Markdoc.transform(Markdoc.parse(body), config),
                                React,
                                {
                                  components: markdocComponents,
                                }
                              )}
                            </article>
                          </section>
                        ) : (
                          <section className="mx-auto pb-4 max-w-xl py-6 px-4 sm:p-6 lg:pb-8">
                            <input
                              autoFocus
                              className="bg-smoke border-none text-2xl leading-5 outline-none focus:ring-0"
                              placeholder="Article title"
                              type="text"
                              aria-label="Post Content"
                              {...register("title")}
                            />

                            <CustomTextareaAutosize
                              placeholder="Enter your content here 💖"
                              className="bg-smoke border-none focus:ring-0 text-lg outline-none shadow-none mb-8"
                              minRows={25}
                              {...register("body")}
                              inputRef={textareaRef}
                            />
                          </section>
                        )}
                      </div>
                    </div>
                    {/* End main area */}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
        <EditorHints />
      </div>
    </LayoutEditor>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await unstable_getServerSession(
    context.req,
    context.res,
    authOptions
  );

  if (!session) {
    return {
      redirect: {
        destination: "/get-started",
        permanent: false,
      },
    };
  }

  return {
    props: {},
  };
};

export default Create;
