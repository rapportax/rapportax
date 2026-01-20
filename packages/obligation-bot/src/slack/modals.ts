export const ADMIN_LOGIN_VIEW_ID = "admin_login_modal";

export function buildAdminLoginModal() {
  return {
    type: "modal",
    callback_id: ADMIN_LOGIN_VIEW_ID,
    title: { type: "plain_text", text: "Admin Login" },
    submit: { type: "plain_text", text: "Login" },
    close: { type: "plain_text", text: "Cancel" },
    blocks: [
      {
        type: "input",
        block_id: "username_block",
        element: {
          type: "plain_text_input",
          action_id: "username_input",
          placeholder: { type: "plain_text", text: "admin" },
        },
        label: { type: "plain_text", text: "Username" },
      },
      {
        type: "input",
        block_id: "password_block",
        element: {
          type: "plain_text_input",
          action_id: "password_input",
          placeholder: { type: "plain_text", text: "password" },
        },
        label: { type: "plain_text", text: "Password" },
      },
    ],
  };
}

export function parseAdminLogin(viewState: Record<string, Record<string, { value?: string }>>) {
  const username = viewState?.username_block?.username_input?.value ?? "";
  const password = viewState?.password_block?.password_input?.value ?? "";
  return { username, password };
}
