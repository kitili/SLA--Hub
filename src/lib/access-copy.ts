export function accessActionLabel(action: string): string {
  switch (action) {
    case "signed_in":
      return "Signed in";
    case "signed_out":
      return "Signed out";
    case "opened_hub":
      return "Opened hub";
    case "opened_desk":
      return "Entered";
    default:
      return action;
  }
}

export function formatAccessWhen(iso: string): string {
  return new Intl.DateTimeFormat("en-TZ", {
    timeZone: "Africa/Dar_es_Salaam",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}
