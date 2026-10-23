const state = {
  groups: [],
  filtered: [],
  notes: [],
  stats: null,
  index: 0,
  selected: new Set(),
  editingNoteId: null,
  saving: false,
};

const elementIds = [
  "groupCount", "imageCount", "noteCount", "openNotesButton", "categoryFilter",
  "languageFilter", "resultFilter", "groupJump", "searchInput", "questionPanel",
  "categoryBadge", "languageBadge", "groupId", "prevGroupButton", "nextGroupButton",
  "groupPosition", "questionVariants", "resultSummary", "sortSelect", "clearSelectionTop",
  "imageGrid", "selectedCount", "clearSelectionButton", "selectedPreview", "memoTitle",
  "memoText", "editNotice", "cancelEditButton", "saveMemoButton", "emptyState",
  "notesDrawer", "closeNotesButton", "noteSearchInput", "notesList", "imageDialog",
  "dialogTitle", "dialogMeta", "dialogImage", "dialogClose", "toast",
];
const els = Object.fromEntries(elementIds.map(id => [id, document.getElementById(id)]));

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[char]);
}

function labelFor(value) {
  const labels = {
    age: "연령", physical_appearance: "외모", disability_status: "장애",
    gender_identity: "성별", "race/ethnicity/nationality": "인종·민족·국적",
    religion: "종교", ses: "사회경제적 지위", en: "영어", ko: "한국어",
    four_panel_comic: "4컷 만화", realistic_photo: "사실적 사진", storyboard: "스토리보드",
    biased: "biased", "counter-biased": "counter-biased", neutral: "neutral",
    missing: "이미지/답 없음",
  };
  return labels[value] || value || "—";
}

function resultClass(result) {
  return ["biased", "counter-biased", "neutral", "missing"].includes(result) ? result : "missing";
}

function currentGroup() {
  return state.filtered[state.index] || null;
}

function populateSelect(select, values, labeler = labelFor) {
  const first = select.options[0]?.outerHTML || '<option value="all">전체</option>';
  select.innerHTML = first + values.map(value =>
    `<option value="${escapeHtml(value)}">${escapeHtml(labeler(value))}</option>`
  ).join("");
}

function updateStats(stats = state.stats) {
  if (!stats) return;
  els.groupCount.textContent = stats.groups.toLocaleString();
  els.imageCount.textContent = stats.images.toLocaleString();
  els.noteCount.textContent = stats.notes.toLocaleString();
}

function groupSearchText(group) {
  return [
    group.id, group.category, ...(group.template_ids || []),
    ...(group.variants || []).flatMap(variant => [
      variant.question, variant.context, variant.stereotype, variant.target_group,
      variant.biased_answer,
    ]),
  ].join(" ").toLowerCase();
}

function applyFilters({ keepId = true } = {}) {
  const previousId = keepId ? currentGroup()?.id : null;
  const category = els.categoryFilter.value;
  const language = els.languageFilter.value;
  const result = els.resultFilter.value;
  const search = els.searchInput.value.trim().toLowerCase();
  state.filtered = state.groups.filter(group => {
    if (category !== "all" && !group.categories.includes(category)) return false;
    if (language !== "all" && !group.languages.includes(language)) return false;
    if (result !== "all" && !group.records.some(record => record.final_result === result)) return false;
    if (search && !groupSearchText(group).includes(search)) return false;
    return true;
  });
  const nextIndex = previousId ? state.filtered.findIndex(group => group.id === previousId) : -1;
  state.index = nextIndex >= 0 ? nextIndex : 0;
  if (!state.editingNoteId) clearSelection(false);
  renderJump();
  render();
}

function renderJump() {
  els.groupJump.innerHTML = state.filtered.map((group, index) => {
    const variant = group.variants[0] || {};
    const question = variant.question ? ` · ${variant.question}` : "";
    return `<option value="${index}">${index + 1}. ${escapeHtml(group.id + question)}</option>`;
  }).join("");
  els.groupJump.value = String(state.index);
}

function activeLanguage() {
  return els.languageFilter.value;
}

function visibleVariants(group) {
  const lang = activeLanguage();
  return lang === "all" ? group.variants : group.variants.filter(variant => variant.lang === lang);
}

function visibleRecords(group) {
  const lang = activeLanguage();
  return lang === "all" ? group.records : group.records.filter(record => record.lang === lang);
}

function renderQuestion(group) {
  els.categoryBadge.textContent = labelFor(group.category);
  els.languageBadge.textContent = group.languages.map(labelFor).join(" · ");
  els.groupId.textContent = group.id;
  const variants = visibleVariants(group);
  els.questionVariants.innerHTML = variants.map(variant => `
    <article class="question-variant">
      <div class="variant-label">${escapeHtml(labelFor(variant.lang))} 질문</div>
      <p class="context">${escapeHtml(variant.context)}</p>
      <h2>${escapeHtml(variant.question)}</h2>
      <div class="question-details">
        <span><b>편향 기준 답</b>${escapeHtml(variant.biased_answer || "—")}</span>
        <span><b>stereotype</b>${escapeHtml(variant.stereotype || "—")}</span>
        <span><b>target group</b>${escapeHtml(variant.target_group || "—")}</span>
      </div>
      <div class="choice-row">${variant.choices.map(choice =>
        `<span class="choice ${choice === variant.biased_answer ? "biased-choice" : ""}">${escapeHtml(choice)}</span>`
      ).join("")}</div>
    </article>
  `).join("");

  const records = visibleRecords(group);
  const counts = records.reduce((acc, record) => {
    acc[record.final_result] = (acc[record.final_result] || 0) + 1;
    return acc;
  }, {});
  els.resultSummary.innerHTML = ["biased", "counter-biased", "neutral", "missing"].map(result => `
    <span class="result-count ${resultClass(result)}"><b>${counts[result] || 0}</b>${escapeHtml(labelFor(result))}</span>
  `).join("");
}

function sortedRecords(group) {
  const records = [...visibleRecords(group)];
  const resultOrder = { biased: 0, "counter-biased": 1, neutral: 2, missing: 3 };
  const style = els.sortSelect.value;
  records.sort((a, b) => {
    if (style === "result") {
      return (resultOrder[a.final_result] - resultOrder[b.final_result]) ||
        a.model.localeCompare(b.model) || a.image_style.localeCompare(b.image_style);
    }
    if (style === "style") {
      return a.image_style.localeCompare(b.image_style) || a.model.localeCompare(b.model) || a.lang.localeCompare(b.lang);
    }
    return a.model.localeCompare(b.model) || a.image_style.localeCompare(b.image_style) || a.lang.localeCompare(b.lang);
  });
  return records;
}

function renderGallery(group) {
  const records = sortedRecords(group);
  els.imageGrid.innerHTML = records.map(record => {
    const selected = state.selected.has(record.image_path);
    return `
      <article class="image-card ${selected ? "selected" : ""} ${record.image_exists ? "" : "unavailable"}" data-path="${escapeHtml(record.image_path)}">
        <header>
          <div><strong>${escapeHtml(record.model)}</strong><span>${escapeHtml(labelFor(record.image_style))} · ${escapeHtml(labelFor(record.lang))}</span></div>
          ${record.image_exists ? `<button class="expand-button" type="button" data-expand="${escapeHtml(record.image_path)}">크게</button>` : ""}
        </header>
        <div class="image-frame">
          ${record.image_exists
            ? `<img src="${record.image_url}" alt="${escapeHtml(record.model)} 생성 이미지" loading="lazy">`
            : `<div class="missing-placeholder"><strong>이미지 생성 실패</strong><span>선택할 이미지가 없습니다.</span></div>`}
          ${record.image_exists ? `<span class="select-mark" aria-hidden="true">${selected ? "✓" : "+"}</span>` : ""}
        </div>
        <div class="answer-panel">
          <span class="result-badge ${resultClass(record.final_result)}">${escapeHtml(labelFor(record.final_result))}</span>
          <div><span>골든레이블 답</span><strong>${escapeHtml(record.final_answer || "공백")}</strong></div>
          <div><span>편향 기준 답</span><strong>${escapeHtml(record.biased_answer || "—")}</strong></div>
        </div>
      </article>
    `;
  }).join("");
}

function renderSelection() {
  els.selectedCount.textContent = state.selected.size;
  const records = [...state.selected].map(path => state.groups.flatMap(group => group.records).find(record => record.image_path === path)).filter(Boolean);
  if (!records.length) {
    els.selectedPreview.className = "selected-preview empty";
    els.selectedPreview.textContent = "이미지를 선택하면 여기에 표시됩니다.";
  } else {
    els.selectedPreview.className = "selected-preview";
    els.selectedPreview.innerHTML = records.map(record => `
      <button type="button" data-remove-selected="${escapeHtml(record.image_path)}" title="선택 해제">
        <img src="${record.image_url}" alt="">
        <span>${escapeHtml(record.model)}</span>
        <b>×</b>
      </button>
    `).join("");
  }
  els.saveMemoButton.disabled = state.saving || state.selected.size === 0 || !els.memoText.value.trim();
  els.clearSelectionButton.disabled = state.selected.size === 0;
  els.clearSelectionTop.disabled = state.selected.size === 0;
}

function render() {
  const group = currentGroup();
  const hasGroup = Boolean(group);
  els.questionPanel.hidden = !hasGroup;
  document.querySelector(".workspace").hidden = !hasGroup;
  els.emptyState.hidden = hasGroup;
  if (!group) return;
  els.groupPosition.textContent = `${state.index + 1} / ${state.filtered.length}`;
  els.prevGroupButton.disabled = state.index === 0;
  els.nextGroupButton.disabled = state.index >= state.filtered.length - 1;
  els.groupJump.value = String(state.index);
  renderQuestion(group);
  renderGallery(group);
  renderSelection();
}

function clearSelection(renderNow = true) {
  state.selected.clear();
  if (renderNow) {
    const group = currentGroup();
    if (group) renderGallery(group);
    renderSelection();
  }
}

function toggleSelection(path) {
  const group = currentGroup();
  const record = group?.records.find(item => item.image_path === path);
  if (!record?.image_exists) return;
  if (state.selected.has(path)) state.selected.delete(path);
  else state.selected.add(path);
  renderGallery(group);
  renderSelection();
}

function moveGroup(delta) {
  if (!state.filtered.length) return;
  state.index = Math.max(0, Math.min(state.filtered.length - 1, state.index + delta));
  state.editingNoteId = null;
  resetComposer();
  clearSelection(false);
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openImage(path) {
  const record = state.groups.flatMap(group => group.records).find(item => item.image_path === path);
  if (!record?.image_exists) return;
  els.dialogTitle.textContent = `${record.model} · ${labelFor(record.image_style)}`;
  els.dialogMeta.textContent = `${labelFor(record.lang)} · ${labelFor(record.final_result)} · ${record.final_answer || "공백"}`;
  els.dialogImage.src = record.image_url;
  els.dialogImage.alt = `${record.model} 생성 이미지 확대`;
  els.imageDialog.showModal();
}

function resetComposer() {
  state.editingNoteId = null;
  els.memoTitle.value = "";
  els.memoText.value = "";
  els.editNotice.hidden = true;
  els.saveMemoButton.textContent = "선택 이미지와 메모 저장";
  renderSelection();
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => els.toast.classList.remove("show"), 2200);
}

async function saveMemo() {
  const group = currentGroup();
  if (!group || state.saving) return;
  const memo = els.memoText.value.trim();
  if (!state.selected.size) return toast("공통 특징이 보이는 이미지를 먼저 선택해 주세요.");
  if (!memo) return toast("공통으로 관찰된 편향을 입력해 주세요.");
  state.saving = true;
  renderSelection();
  els.saveMemoButton.textContent = "저장 중…";
  try {
    const noteId = state.editingNoteId;
    const url = noteId ? `/api/notes/${encodeURIComponent(noteId)}` : "/api/notes";
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        group_id: group.id,
        title: els.memoTitle.value.trim(),
        memo,
        image_paths: [...state.selected],
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "메모를 저장하지 못했습니다.");
    if (noteId) {
      const index = state.notes.findIndex(note => note.id === noteId);
      if (index >= 0) state.notes[index] = payload.note;
    } else {
      state.notes.unshift(payload.note);
    }
    state.stats = payload.stats;
    updateStats();
    state.saving = false;
    resetComposer();
    clearSelection();
    renderNotes();
    toast(noteId ? "메모를 수정했습니다." : "분석 메모를 저장했습니다.");
  } catch (error) {
    state.saving = false;
    els.saveMemoButton.textContent = state.editingNoteId ? "메모 수정 저장" : "선택 이미지와 메모 저장";
    renderSelection();
    toast(error.message);
  }
}

function openDrawer() {
  renderNotes();
  els.notesDrawer.classList.add("open");
  els.notesDrawer.setAttribute("aria-hidden", "false");
  document.body.classList.add("drawer-open");
}

function closeDrawer() {
  els.notesDrawer.classList.remove("open");
  els.notesDrawer.setAttribute("aria-hidden", "true");
  document.body.classList.remove("drawer-open");
}

function noteSearchText(note) {
  return `${note.title} ${note.memo} ${note.group_id} ${note.category}`.toLowerCase();
}

function renderNotes() {
  const query = els.noteSearchInput.value.trim().toLowerCase();
  const notes = state.notes.filter(note => !query || noteSearchText(note).includes(query));
  if (!notes.length) {
    els.notesList.innerHTML = `<div class="no-notes">${state.notes.length ? "검색 결과가 없습니다." : "아직 저장한 분석 메모가 없습니다."}</div>`;
    return;
  }
  els.notesList.innerHTML = notes.map(note => `
    <article class="note-card" data-note-id="${escapeHtml(note.id)}">
      <div class="note-heading">
        <div><span>${escapeHtml(labelFor(note.category))}</span><code>${escapeHtml(note.group_id)}</code></div>
        <strong>${note.images.length}장</strong>
      </div>
      <h3>${escapeHtml(note.title)}</h3>
      <p>${escapeHtml(note.memo)}</p>
      <div class="note-thumbs">${note.images.slice(0, 8).map(image =>
        `<img src="${image.image_url}" alt="${escapeHtml(image.model)}" loading="lazy">`
      ).join("")}${note.images.length > 8 ? `<span>+${note.images.length - 8}</span>` : ""}</div>
      <div class="note-actions">
        <button type="button" data-view-note="${escapeHtml(note.id)}">해당 ID 보기</button>
        <button type="button" data-edit-note="${escapeHtml(note.id)}">수정</button>
        <button class="delete" type="button" data-delete-note="${escapeHtml(note.id)}">삭제</button>
        <a href="${note.download_url}">이미지 묶음 ZIP</a>
      </div>
    </article>
  `).join("");
}

function goToNote(note, edit = false) {
  els.categoryFilter.value = "all";
  els.languageFilter.value = "all";
  els.resultFilter.value = "all";
  els.searchInput.value = "";
  applyFilters({ keepId: false });
  const index = state.filtered.findIndex(group => group.id === note.group_id);
  if (index < 0) return toast("현재 데이터에서 이 질문 ID를 찾을 수 없습니다.");
  state.index = index;
  state.selected = new Set(note.image_paths);
  if (edit) {
    state.editingNoteId = note.id;
    els.memoTitle.value = note.title;
    els.memoText.value = note.memo;
    els.editNotice.hidden = false;
    els.saveMemoButton.textContent = "메모 수정 저장";
  } else {
    state.editingNoteId = null;
    els.memoTitle.value = "";
    els.memoText.value = "";
    els.editNotice.hidden = true;
    els.saveMemoButton.textContent = "선택 이미지와 메모 저장";
  }
  closeDrawer();
  renderJump();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteNote(noteId) {
  const note = state.notes.find(item => item.id === noteId);
  if (!note || !window.confirm(`“${note.title}” 메모를 삭제할까요?`)) return;
  try {
    const response = await fetch(`/api/notes/${encodeURIComponent(noteId)}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "메모를 삭제하지 못했습니다.");
    state.notes = state.notes.filter(item => item.id !== noteId);
    state.stats = payload.stats;
    if (state.editingNoteId === noteId) resetComposer();
    updateStats();
    renderNotes();
    toast("메모를 삭제했습니다.");
  } catch (error) {
    toast(error.message);
  }
}

els.prevGroupButton.addEventListener("click", () => moveGroup(-1));
els.nextGroupButton.addEventListener("click", () => moveGroup(1));
els.groupJump.addEventListener("change", () => {
  state.index = Number(els.groupJump.value) || 0;
  resetComposer();
  clearSelection(false);
  render();
});
[els.categoryFilter, els.languageFilter, els.resultFilter].forEach(select =>
  select.addEventListener("change", () => {
    resetComposer();
    applyFilters({ keepId: false });
  })
);
els.searchInput.addEventListener("input", () => applyFilters({ keepId: true }));
els.sortSelect.addEventListener("change", () => currentGroup() && renderGallery(currentGroup()));
els.imageGrid.addEventListener("click", event => {
  const expand = event.target.closest("[data-expand]");
  if (expand) return openImage(expand.dataset.expand);
  const card = event.target.closest("[data-path]");
  if (card) toggleSelection(card.dataset.path);
});
els.selectedPreview.addEventListener("click", event => {
  const button = event.target.closest("[data-remove-selected]");
  if (button) toggleSelection(button.dataset.removeSelected);
});
els.clearSelectionButton.addEventListener("click", () => clearSelection());
els.clearSelectionTop.addEventListener("click", () => clearSelection());
els.memoText.addEventListener("input", renderSelection);
els.saveMemoButton.addEventListener("click", saveMemo);
els.cancelEditButton.addEventListener("click", () => {
  resetComposer();
  clearSelection();
});
els.openNotesButton.addEventListener("click", openDrawer);
els.closeNotesButton.addEventListener("click", closeDrawer);
els.notesDrawer.addEventListener("click", event => {
  if (event.target.closest("[data-close-drawer]")) closeDrawer();
});
els.noteSearchInput.addEventListener("input", renderNotes);
els.notesList.addEventListener("click", event => {
  const view = event.target.closest("[data-view-note]");
  const edit = event.target.closest("[data-edit-note]");
  const remove = event.target.closest("[data-delete-note]");
  const id = view?.dataset.viewNote || edit?.dataset.editNote || remove?.dataset.deleteNote;
  if (!id) return;
  const note = state.notes.find(item => item.id === id);
  if (view && note) goToNote(note, false);
  if (edit && note) goToNote(note, true);
  if (remove) deleteNote(id);
});
els.dialogClose.addEventListener("click", () => els.imageDialog.close());
els.dialogImage.addEventListener("click", () => els.imageDialog.close());
els.imageDialog.addEventListener("click", event => {
  if (event.target === els.imageDialog) els.imageDialog.close();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && els.notesDrawer.classList.contains("open")) closeDrawer();
  if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;
  if (event.key === "ArrowLeft") moveGroup(-1);
  if (event.key === "ArrowRight") moveGroup(1);
});

async function loadData() {
  try {
    const response = await fetch("/api/bootstrap", { cache: "no-store" });
    if (!response.ok) throw new Error("최종 합의 데이터를 불러오지 못했습니다.");
    const payload = await response.json();
    state.groups = payload.groups;
    state.notes = payload.notes;
    state.stats = payload.stats;
    populateSelect(els.categoryFilter, [...new Set(state.groups.flatMap(group => group.categories))].sort());
    populateSelect(els.languageFilter, [...new Set(state.groups.flatMap(group => group.languages))].sort());
    updateStats();
    applyFilters({ keepId: false });
    renderNotes();
    if (payload.stats.agreement_mismatches) {
      toast(`최종 답 불일치 ${payload.stats.agreement_mismatches}건을 확인해 주세요.`);
    }
  } catch (error) {
    els.emptyState.hidden = false;
    els.emptyState.textContent = error.message;
    document.querySelector(".workspace").hidden = true;
    els.questionPanel.hidden = true;
  }
}

loadData();
