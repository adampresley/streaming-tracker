import { Spinner } from "/static/js/spinner.min.js";

const spinner = new Spinner();
let spinnerTimer;

document.body.addEventListener("htmx:beforeRequest", () => {
	spinnerTimer = setTimeout(() => {
		spinner.show();
	}, 1000);
});

document.body.addEventListener("htmx:afterRequest", () => {
   clearTimeout(spinnerTimer);
   spinner.hide();
});

document.body.addEventListener("htmx:afterSettle", () => {
	clearTimeout(spinnerTimer);
	spinner.hide();
});

document.body.addEventListener("htmx:afterSwap", () => {
	clearTimeout(spinnerTimer);
	spinner.hide();
});

document.body.addEventListener("htmx:historyRestore", () => {
	clearTimeout(spinnerTimer);
	document.querySelector("div.spinner").remove();
});
