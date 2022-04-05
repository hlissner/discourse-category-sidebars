import { ajax } from "discourse/lib/ajax";
import { createWidget } from "discourse/widgets/widget";
import { getOwner } from "discourse-common/lib/get-owner";
import { h } from "virtual-dom";
import PostCooked from "discourse/widgets/post-cooked";

// This plugin originally only supported:
// X,postId
//   match all categories and sub-categories with slug X
//
// This fork adds the following:
// - X/,postId
//     Any sub-category whose parent's slug is X
// - /Y,postId
//     Any subcategory whose slug is Y
// - X/Y,postId
//     Any subcategory Y under X
//
// With this new specificity, the inherit_parent_sidebar setting is redundant,
// so it was removed.

function parseIDs(raw) {
  const parsed = {};
  raw.split("|").forEach((setting) => {
    const [target, id] = setting.split(',').map(s => s.trim());
    parsed[target] = parsed[target] || id;
  });
  return parsed;
}

function createSidebar(slug, subSlug) {
  [slug, subSlug] = [slug, subSlug]
    .filter(x => x)
    .map(x => x === '' ? undefined : x);
  let id = ((slug && subSlug && ids[`${slug}/${subSlug}`])
            || (subSlug && ids[`/${subSlug}`])
            || (slug    && ids[`${slug}/`])
            || (subSlug && ids[subSlug])
            || (slug    && ids[slug]));
  if (!id) { return; }

  const post = [this.getPost(id)];

  document
    .querySelector("body")
    .classList.add("custom-sidebar", "sidebar-" + settings.sidebar_side);
  document
    .querySelector(".topic-list")
    .classList.add("with-sidebar", settings.sidebar_side);

  return h(
    "div.category-sidebar-contents " + ".category-sidebar--"
      + [slug, subSlug].filter(x => x).join('-'),
    post
  );
}

const postCache = {};
const ids = parseIDs(settings.setup);

createWidget("category-sidebar", {
  tagName: "div.sticky-sidebar",

  init() {
    let sidebarWrapper =
      document.getElementsByClassName("category-sidebar")[0] || 0;
    let headerHeight =
      document.getElementsByClassName("d-header-wrap")[0].offsetHeight || 0;
    let sidebarTop = headerHeight + 20 + "px";
    let sidebarMaxHeight = "calc(100vh - " + (headerHeight + 40) + "px)";
    if (sidebarWrapper) {
      sidebarWrapper.style.maxHeight = sidebarMaxHeight;
      sidebarWrapper.style.top = sidebarTop;
    }
  },

  html() {
    const router = getOwner(this).lookup("router:main");
    const currentRouteParams = router.currentRoute.params;
    const isCategoryTopicList = currentRouteParams.hasOwnProperty(
      "category_slug_path_with_id"
    );

    if (ids["all"] && !isCategoryTopicList) {
      return createSidebar.call(this, "all");
    } else if (isCategoryTopicList) {
      const categorySlugPath =
        currentRouteParams.category_slug_path_with_id.split("/");
      const categorySlug = categorySlugPath[0];
      const subcategorySlug = categorySlugPath[categorySlugPath.length - 2];

      const h = createSidebar.call(this, categorySlug, subcategorySlug)
      if (h) { return h; }
    }

    // Remove classes if no sidebar returned
    document
      .querySelector("body")
      .classList.remove("custom-sidebar", "sidebar-" + settings.sidebar_side);
    document
      .querySelector(".topic-list")
      .classList.remove("with-sidebar", settings.sidebar_side);
  },

  getPost(id) {
    if (!postCache[id]) {
      ajax(`/t/${id}.json`).then((response) => {
        postCache[id] = new PostCooked({
          cooked: response.post_stream.posts[0].cooked,
        });
        this.scheduleRerender();
      });
    }
    return postCache[id];
  },
});
