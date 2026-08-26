/**
 * Marketing.
 *
 * Subscribers are readable now. Sending is not built yet, and this screen says
 * so plainly rather than showing a button that does nothing — sending needs a
 * Resend account, a verified sending domain, and the SPF, DKIM and DMARC
 * records that keep mail out of spam folders.
 */
import { el } from "../dom.js";
import { listRequests } from "./api.js";

export async function marketing(view) {
  // Consent lives in marketing_subscribers, which is written by the request
  // handler. Until that exists there is nothing to list, so say that instead
  // of showing an empty table that looks broken.
  const anyRequests = (await listRequests({ limit: 1 })).length > 0;

  view.replaceChildren(
    el("h2", { text: "Marketing" }),
    el("p", { class: "lede", text: "People who ticked the offers box when they sent a request." }),

    el("div", { class: "msg msg--info", text:
      "Sending is not set up yet. It needs a Resend account and a verified sending domain — " +
      "without those, campaign mail lands in spam." }),

    el("div", { class: "empty" }, [
      el("strong", { text: "No subscribers yet" }),
      el("span", { text: anyRequests
        ? "Nobody has ticked the offers box so far."
        : "The consent box appears on the website's request form, which is not live yet." })
    ]),

    el("section", { class: "card" }, [
      el("h3", { text: "How consent works here" }),
      el("p", { class: "row__meta", text:
        "The box is never pre-ticked, and the build refuses to ship a page where it is. " +
        "Consent is stored with the date it was given, so you can always show when someone agreed. " +
        "Campaigns only ever go to people who ticked it and have not unsubscribed." })
    ])
  );
}
