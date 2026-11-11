window.mountAssignmentOverview = function (host, initial, hooks) {
  let snapshot = initial;
  let editing = null;
  let saving = false;
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]);
  const today = () => new Intl.DateTimeFormat("sv-SE", {timeZone:"Asia/Tokyo"}).format(new Date());
  const writable = () => snapshot.date >= today();
  const primaryTasks = snapshot.tasks.filter(task => task.id.startsWith("task-"));
  host.innerHTML = '<div class="ap-app"><div class="ap-header"><div class="ap-date"><h2>担当・進捗</h2><p data-overview-date></p></div>' +
    '<div class="ap-nav"><div class="ap-days" role="group" aria-label="表示する日付"></div>' +
    '<button type="button" data-overview-action="edit">担当を修正</button><button type="button" data-overview-action="home">トップへ戻る</button></div></div>' +
    '<div class="ap-body aw-edit-body"></div><div class="ap-status"><span id="aw-completion-count"></span><span id="aw-completion-status" role="status"></span></div>' +
    '<dialog class="ap-dialog" aria-labelledby="overview-text-title"><h3 id="overview-text-title"></h3>' +
    '<p data-overview-full></p><form method="dialog" data-overview-read><div class="ap-dialog-actions"><button>閉じる</button></div></form>' +
    '<form data-overview-form hidden><label for="overview-text-input">本文</label><textarea id="overview-text-input" rows="6"></textarea>' +
    '<p data-overview-error role="alert"></p><div class="ap-dialog-actions"><button type="button" data-overview-cancel>キャンセル</button><button class="ap-save-text">保存</button></div></form></dialog></div>';
  const element = host.querySelector(".ap-app");
  const body = element.querySelector(".ap-body");
  const dialog = element.querySelector("dialog");
  const form = dialog.querySelector("[data-overview-form]");
  const input = form.querySelector("textarea");

  function personNames(value) {
    const names = [value?.main, value?.sub].filter(name => name && !["ーー","－－","--"].includes(name));
    return names.length ? names.map(name => '<span>' + escapeHtml(name) + '</span>').join('<span aria-hidden="true">／</span>') : '<span class="ap-note">ーー</span>';
  }

  function check(id, label) {
    if (!Object.hasOwn(snapshot.completion, id)) return "";
    const checked = snapshot.completion[id];
    if (!writable()) return '<span class="ap-note" aria-label="' + escapeHtml(label) + (checked ? ' 完了">済' : ' 未完了">未') + '</span>';
    return '<label class="ap-check"><input type="checkbox" data-completion="' + id + '" aria-label="' + escapeHtml(label) + 'の完了"' + (checked ? " checked" : "") + '></label>';
  }

  function done(id) { return snapshot.completion[id] ? ' class="aw-completion-done"' : ""; }

  function field(id) {
    if (id.startsWith("handover-")) {
      const note = snapshot.handover.find(row => row.id === id);
      return {label:"申し送り事項 " + (Number(id.split("-")[1]) + 1), text:note?.text ?? ""};
    }
    return {label:(snapshot.tasks.find(task => task.id === id)?.name ?? "") + "の特記事項", text:snapshot.notes[id] ?? ""};
  }

  function textCell(id) {
    const {text, label} = field(id);
    const preview = text ? '<button type="button" class="ap-detail" data-overview-read-text="' + id + '">' + escapeHtml(text.replace(/\r?\n/g," ")) + '</button>' : '<span class="ap-note">—</span>';
    const pencil = writable() ? '<button type="button" class="ap-pencil" data-overview-edit-text="' + id + '" aria-label="' + escapeHtml(label) + 'を編集"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M1 15l1-5 9-9 4 4-9 9zM9 3l4 4"/></svg></button>' : "";
    return '<div class="ap-text-field">' + preview + pencil + '</div>';
  }

  function taskTable() {
    const rows = primaryTasks.map(task => {
      return '<tr data-completion-item="' + task.id + '"' + done(task.id) + '><th scope="row">' + escapeHtml(task.name) +
        '</th><td class="ap-names">' + personNames(snapshot.assignments[task.id]) + '</td><td>' + textCell(task.id) +
        '</td><td class="ap-check-cell">' + check(task.id,task.name) + '</td></tr>';
    }).join("");
    return '<section><table class="ap-tasks" aria-label="日次業務"><colgroup><col><col><col><col></colgroup>' +
      '<thead><tr><th scope="col" class="ap-table-title" aria-label="業務">日次業務</th><th scope="col">担当者</th><th scope="col">特記事項</th><th scope="col" class="ap-completion-heading">完了</th></tr></thead><tbody>' + rows + '</tbody></table></section>';
  }

  function floorTable() {
    const rows = [13,14,15,16,17,18].map((row, index) => '<tr><th scope="row">' + (index+1) + '階</th>' +
      [27,34,41].map(column => {
        const id = "floor-" + row + "-" + column;
        const name = snapshot.tasks.find(task => task.id === id)?.name ?? "";
        return '<td data-completion-item="' + id + '"' + done(id) + '><div class="ap-floor-person"><span class="ap-names">' +
          personNames(snapshot.assignments[id]) + '</span>' + check(id,name) + '</div></td>';
      }).join("") + '</tr>').join("");
    return '<section><table class="ap-floor" aria-label="担当"><colgroup><col><col><col><col></colgroup>' +
      '<thead><tr><th scope="col" class="ap-table-title" aria-label="階">担当</th><th scope="col">リネン</th><th scope="col">ベッドメイク</th><th scope="col">客室点検</th></tr></thead><tbody>' + rows + '</tbody></table></section>';
  }

  function smallTable(title, prefix, completion) {
    const list = snapshot.tasks.filter(task => task.id.startsWith(prefix));
    const rows = list.map(task => '<tr data-completion-item="' + task.id + '"' + done(task.id) + '><th scope="row">' +
      escapeHtml(task.name) + '</th><td class="ap-names">' + personNames(snapshot.assignments[task.id]) + '</td>' +
      (completion ? '<td class="ap-check-cell">' + check(task.id,task.name) + '</td>' : "") + '</tr>').join("");
    return '<section><table class="ap-small ' + (completion ? 'ap-clean' : '') + '" aria-label="' + title + '">' +
      '<colgroup><col><col>' + (completion ? '<col>' : '') + '</colgroup><thead><tr><th scope="col" class="ap-table-title" aria-label="業務">' + title + '</th><th scope="col">担当者</th>' +
      (completion ? '<th scope="col" class="ap-completion-heading">完了</th>' : "") + '</tr></thead><tbody>' + rows + '</tbody></table></section>';
  }

  function render() {
    element.dataset.day = snapshot.date < today() ? "yesterday" : snapshot.date === today() ? "today" : "tomorrow";
    const index = snapshot.dates.indexOf(snapshot.date);
    const label = ["昨日","本日","明日"][index] ?? "対象日";
    element.querySelector("[data-overview-date]").textContent = label + " " +
      new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",year:"numeric",month:"long",day:"numeric",weekday:"short"}).format(new Date(snapshot.date+"T12:00:00+09:00")) +
      (writable() ? "" : "　閲覧専用");
    element.querySelector(".ap-days").innerHTML = snapshot.dates.map((date,index) =>
      '<button type="button" data-overview-day="' + date + '" aria-pressed="' + (date === snapshot.date) + '">' + ["昨日","本日","明日"][index] + '</button>').join("");
    element.querySelector('[data-overview-action="edit"]').hidden = !writable();
    const notes = snapshot.handover.map(note => '<tr><td>' + textCell(note.id) + '</td><td>' +
      escapeHtml(note.person || "—") + '</td><td>' + escapeHtml(note.deadline || "—") + '</td></tr>').join("");
    const shifts = ["早番","遅出","中抜","9時出","フロント"].map((label,index) => {
      const names = snapshot.attendance[index] ?? [];
      return '<div><dt>' + label + '</dt><dd>' + (names.length ?
        names.map(name => '<span>' + escapeHtml(name) + '</span>').join(" ") : '<span class="ap-note">ーー</span>') + '</dd></div>';
    }).join("");
    body.innerHTML = '<div class="ap-overview"><section class="ap-handoff"><h3 class="ap-section-title">申し送り</h3><table><colgroup><col><col><col></colgroup>' +
      '<thead><tr><th scope="col">内容</th><th scope="col">引き継ぎ担当</th><th scope="col">期限</th></tr></thead><tbody>' + notes + '</tbody></table></section>' +
      '<section><h3 class="ap-section-title">出勤者</h3><dl class="ap-shifts">' + shifts + '</dl></section></div>' +
      '<div class="ap-layout">' + taskTable() + '<div class="ap-side">' + floorTable() +
      '<div class="ap-pair">' + smallTable("清掃業務","clean-",true) + smallTable("共通業務","common-",false) + '</div></div></div>';
    const values = Object.values(snapshot.completion);
    element.querySelector("#aw-completion-count").textContent = "完了 " + values.filter(Boolean).length + " / " + values.length + "件";
  }

  function openText(id, edit) {
    const current = field(id);
    editing = edit ? {id,previous:current.text,date:snapshot.date} : null;
    dialog.querySelector("h3").textContent = current.label + (edit ? "を編集" : "");
    form.hidden = !edit;
    dialog.querySelector("[data-overview-read]").hidden = edit;
    dialog.querySelector("[data-overview-full]").hidden = edit;
    dialog.querySelector("[data-overview-full]").textContent = current.text;
    dialog.querySelector("[data-overview-error]").textContent = "";
    input.value = current.text;
    dialog.showModal();
    if (edit) input.focus();
  }

  element.addEventListener("click", event => {
    const day = event.target.closest("[data-overview-day]");
    const action = event.target.closest("[data-overview-action]")?.dataset.overviewAction;
    const edit = event.target.closest("[data-overview-edit-text]");
    const read = event.target.closest("[data-overview-read-text]");
    if (saving) return;
    if (day && day.dataset.overviewDay !== snapshot.date) hooks.onDate(day.dataset.overviewDay);
    if (action === "home") hooks.onHome();
    if (action === "edit") hooks.onEdit();
    if (edit && writable()) openText(edit.dataset.overviewEditText,true);
    if (read) openText(read.dataset.overviewReadText,false);
    if (event.target.closest("[data-overview-cancel]")) dialog.close();
  });
  dialog.addEventListener("cancel", event => { if (saving) event.preventDefault(); });
  dialog.addEventListener("close", () => { editing = null; hooks.onEditorClose(); });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (saving || !editing) return;
    const current = editing;
    setSaving(true);
    try {
      const result = await hooks.saveText({...current,text:input.value});
      if (current.id.startsWith("handover-")) snapshot.handover.find(note => note.id === current.id).text = result.text;
      else snapshot.notes[current.id] = result.text;
      dialog.close();
      render();
      element.querySelector("#aw-completion-status").textContent = "保存済";
      element.querySelector('[data-overview-edit-text="' + current.id + '"]')?.focus({preventScroll:true});
    } catch (error) {
      dialog.querySelector("[data-overview-error]").textContent = error.message || "保存できませんでした。";
    } finally {
      setSaving(false);
      hooks.onEditorClose();
    }
  });

  function setSaving(value) {
    saving = value;
    element.querySelectorAll("input,button,textarea").forEach(control => control.disabled = value);
  }

  render();
  return {
    element, setSaving,
    isEditing: () => dialog.open,
    update(next) {snapshot = next; render();}
  };
};

