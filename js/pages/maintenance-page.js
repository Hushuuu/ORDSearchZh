(() => {
  const {
    clearToast,
    cloneData,
    compareRecords,
    createSkillTypeOptions,
    createIndices,
    createTomSelectOptions,
    createTomSelectRenderConfig,
    downloadTextFile,
    escapeHtml,
    fillLevelSelect,
    getLevelLabel,
    getSearchableText,
    showToast
  } = window.ORDApp;

  function initMaintenancePage(records) {
    const state = {
      records: cloneData(records),
      selectedRecordId: null,
      materialDraft: []
    };

    const listSearchInput = document.getElementById('maintenanceSearchInput');
    const listContainer = document.getElementById('maintenanceList');
    const listSummary = document.getElementById('maintenanceSummary');
    const toast = document.getElementById('maintenanceToast');
    const preview = document.getElementById('maintenancePreview');
    const materialPickerSelect = document.getElementById('materialPickerSelect');
    const materialChips = document.getElementById('fieldMaterialsChips');
    const clearMaterialsButton = document.getElementById('clearMaterialsButton');
    const partnerPickerSelect = document.getElementById('partnerPickerSelect');
    const skillTypesGroup = document.getElementById('fieldSkillTypesGroup');
    const hasTomSelect = typeof window.TomSelect === 'function';

    const fields = {
      character_id: document.getElementById('fieldCharacterId'),
      level: document.getElementById('fieldLevel'),
      name: document.getElementById('fieldName'),
      kr_name: document.getElementById('fieldKrName'),
      en_name: document.getElementById('fieldEnName'),
      key_code: document.getElementById('fieldKeyCode'),
      major: document.getElementById('fieldMajor'),
      remark: document.getElementById('fieldRemark')
    };

    const materialPicker = hasTomSelect
      ? new window.TomSelect(materialPickerSelect, {
          options: [],
          valueField: 'value',
          labelField: 'label',
          searchField: ['label', 'value', 'kr_name', 'en_name'],
          maxOptions: 150,
          create: false,
          persist: false,
          placeholder: '搜尋名稱或 id',
          render: createTomSelectRenderConfig()
        })
      : null;

    const partnerPicker = hasTomSelect
      ? new window.TomSelect(partnerPickerSelect, {
          options: [],
          valueField: 'value',
          labelField: 'label',
          searchField: ['label', 'value', 'kr_name', 'en_name'],
          maxOptions: 150,
          maxItems: null,
          create: false,
          persist: false,
          plugins: ['remove_button'],
          placeholder: '選擇適合夥伴',
          render: createTomSelectRenderConfig()
        })
      : null;

    fillLevelSelect(fields.level);

    function renderSkillTypeCheckboxes(selectedSkillTypes = []) {
      const selectedSet = new Set((selectedSkillTypes || []).map(String));
      skillTypesGroup.innerHTML = createSkillTypeOptions()
        .map(
          ({ value, label }) => `
            <label class="checkbox-badge">
              <input type="checkbox" value="${escapeHtml(value)}" ${selectedSet.has(value) ? 'checked' : ''}>
              <span class="checkbox-badge-label">${escapeHtml(label)}</span>
            </label>
          `
        )
        .join('');
    }

    function getSelectedSkillTypes() {
      return Array.from(skillTypesGroup.querySelectorAll('input:checked')).map((input) => input.value);
    }

    function getIndices(nextRecords = state.records) {
      return createIndices(nextRecords);
    }

    function getSelectedRecord() {
      return state.records.find((record) => record.character_id === state.selectedRecordId) || null;
    }

    function generateCharacterId(level) {
      let counter = 1;
      const indices = getIndices();
      let candidate = `${level}-${counter}`;

      while (indices.byCharacterId.has(candidate)) {
        counter += 1;
        candidate = `${level}-${counter}`;
      }

      return candidate;
    }

    function syncMaintenancePickers() {
      const options = createTomSelectOptions(state.records);

      if (materialPicker) {
        materialPicker.clear(true);
        materialPicker.clearOptions();
        materialPicker.addOptions(options);
        materialPicker.refreshOptions(false);
      }

      if (partnerPicker) {
        const selectedPartners = getSelectedRecord()
          ? (getSelectedRecord().suitable_partners || []).map((partner) => partner.character_id)
          : [];
        partnerPicker.clear(true);
        partnerPicker.clearOptions();
        partnerPicker.addOptions(options);
        partnerPicker.refreshOptions(false);
        partnerPicker.setValue(selectedPartners, true);
      }
    }

    function getFilteredRecords() {
      const keyword = listSearchInput.value.trim().toLowerCase();
      const indices = getIndices();
      const sorted = [...state.records].sort(compareRecords);

      if (!keyword) {
        return { records: sorted, indices };
      }

      return {
        records: sorted.filter((record) => getSearchableText(record, indices).includes(keyword)),
        indices
      };
    }

    function renderMaterialDraft() {
      if (state.materialDraft.length === 0) {
        materialChips.innerHTML = '<span class="muted">尚未加入材料。</span>';
        return;
      }

      const indices = getIndices();
      materialChips.innerHTML = state.materialDraft
        .map((characterId, index) => {
          const record = indices.byCharacterId.get(characterId);
          const label = record ? `${record.name}｜${characterId}` : characterId;
          return `
            <span class="selected-chip">
              <span>${escapeHtml(label)}</span>
              <button type="button" data-remove-material-index="${index}">×</button>
            </span>
          `;
        })
        .join('');
    }

    function appendMaterial(characterId) {
      if (!getIndices().byCharacterId.has(characterId)) {
        showToast(toast, 'error', `找不到材料 ID：${characterId}`);
        return;
      }

      state.materialDraft.push(characterId);
      clearToast(toast);
      renderMaterialDraft();
      if (materialPicker) {
        materialPicker.clear(true);
        materialPicker.blur();
      }
    }

    function renderList() {
      const { records: filteredRecords } = getFilteredRecords();
      listSummary.textContent = `目前 ${filteredRecords.length} / ${state.records.length} 筆`;

      listContainer.innerHTML = filteredRecords
        .map(
          (record) => `
            <button type="button" class="record-list-button ${record.character_id === state.selectedRecordId ? 'active' : ''}" data-character-id="${escapeHtml(record.character_id)}">
              <strong>${escapeHtml(record.name)}</strong>
              <div class="record-meta">
                <span>${escapeHtml(record.kr_name || '')}</span>
                <span>${escapeHtml(record.en_name || '')}</span>
              </div>
              <div class="record-meta">
                <span>${escapeHtml(getLevelLabel(record.level))}</span>
                <span>${escapeHtml(record.character_id)}</span>
              </div>
            </button>
          `
        )
        .join('');
    }

    function fillForm() {
      const record = getSelectedRecord();
      if (!record) {
        Object.values(fields).forEach((field) => {
          if ('value' in field) {
            field.value = '';
          }
        });
        state.materialDraft = [];
        renderMaterialDraft();
        if (materialPicker) {
          materialPicker.clear(true);
        }
        if (partnerPicker) {
          partnerPicker.clear(true);
        }
        renderSkillTypeCheckboxes();
        preview.textContent = '尚未選擇資料。';
        return;
      }

      fields.character_id.value = record.character_id || '';
      fields.level.value = String(record.level ?? 0);
      fields.name.value = record.name || '';
      fields.kr_name.value = record.kr_name || '';
      fields.en_name.value = record.en_name || '';
      fields.key_code.value = record.key_code || '';
      fields.major.value = record.major || '';
      fields.remark.value = record.remark || '';
      renderSkillTypeCheckboxes(record.skill_types || []);
      state.materialDraft = (record.materials || []).map((material) => material.material_id);
      renderMaterialDraft();
      if (materialPicker) {
        materialPicker.clear(true);
      }
      if (partnerPicker) {
        partnerPicker.setValue((record.suitable_partners || []).map((partner) => partner.character_id), true);
      }
      preview.textContent = JSON.stringify(record, null, 2);
    }

    function setSelectedRecord(characterId) {
      state.selectedRecordId = characterId;
      renderList();
      fillForm();
    }

    function validateReferences(materials, partners) {
      const indices = getIndices();
      const unknownMaterials = materials
        .map((item) => item.material_id)
        .filter((id) => !indices.byCharacterId.has(id));
      const unknownPartners = partners
        .map((item) => item.character_id)
        .filter((id) => !indices.byCharacterId.has(id));

      if (unknownMaterials.length === 0 && unknownPartners.length === 0) {
        return '';
      }

      const lines = [];
      if (unknownMaterials.length > 0) {
        lines.push(`找不到材料 ID：${unknownMaterials.join('、')}`);
      }
      if (unknownPartners.length > 0) {
        lines.push(`找不到適配角色 ID：${unknownPartners.join('、')}`);
      }
      return lines.join('\n');
    }

    function saveCurrentRecord() {
      const record = getSelectedRecord();
      if (!record) {
        showToast(toast, 'error', '請先選擇一筆資料。');
        return;
      }

      const nextMaterials = state.materialDraft.map((materialId) => ({ material_id: materialId }));
      const nextSkillTypes = getSelectedSkillTypes();
      const selectedPartners = partnerPicker
        ? Array.isArray(partnerPicker.getValue())
          ? partnerPicker.getValue()
          : String(partnerPicker.getValue() || '')
              .split(',')
              .filter(Boolean)
        : [];
      const nextPartners = selectedPartners.map((characterId) => ({ character_id: String(characterId) }));
      const validationMessage = validateReferences(nextMaterials, nextPartners);
      if (validationMessage) {
        showToast(toast, 'error', validationMessage);
        return;
      }

      if (!fields.character_id.value.trim() || !fields.name.value.trim()) {
        showToast(toast, 'error', '角色 ID 與中文名稱不可為空。');
        return;
      }

      const nextCharacterId = fields.character_id.value.trim();
      const nextLevel = Number(fields.level.value || 0);
      if (!nextCharacterId.startsWith(`${nextLevel}-`)) {
        showToast(toast, 'error', `character_id 需以 ${nextLevel}- 開頭，才能符合 level 編碼。`);
        return;
      }

      const duplicateCharacterId = state.records.some(
        (item) => item !== record && item.character_id === nextCharacterId
      );
      if (duplicateCharacterId) {
        showToast(toast, 'error', `character_id 重複：${nextCharacterId}`);
        return;
      }

      Object.assign(record, {
        character_id: nextCharacterId,
        level: nextLevel,
        name: fields.name.value.trim(),
        kr_name: fields.kr_name.value.trim(),
        en_name: fields.en_name.value.trim(),
        key_code: fields.key_code.value.trim(),
        major: fields.major.value.trim(),
        remark: fields.remark.value.trim(),
        skill_types: nextSkillTypes,
        materials: nextMaterials,
        suitable_partners: nextPartners
      });

      clearToast(toast);
      showToast(toast, 'success', '已更新。最後記得要匯出JSON檔！');
      syncMaintenancePickers();
      renderList();
      fillForm();
    }

    function addRecord() {
      const record = {
        character_id: generateCharacterId(0),
        level: 0,
        name: '新資料',
        kr_name: '',
        en_name: '',
        materials: [],
        key_code: '',
        remark: '',
        major: '',
        skill_types: [],
        suitable_partners: []
      };

      state.records.push(record);
      clearToast(toast);
      syncMaintenancePickers();
      setSelectedRecord(record.character_id);
    }

    function deleteRecord() {
      const record = getSelectedRecord();
      if (!record) {
        showToast(toast, 'error', '請先選擇要刪除的資料。');
        return;
      }

      if (!window.confirm(`確定刪除「${record.name}」嗎？`)) {
        return;
      }

      state.records = state.records.filter((item) => item.character_id !== record.character_id);
      state.selectedRecordId = state.records[0]?.character_id || null;
      showToast(toast, 'success', '已刪除資料。最後記得要匯出JSON檔！');
      syncMaintenancePickers();
      renderList();
      fillForm();
    }

    function exportJson() {
      const output = [...state.records].sort(compareRecords);
      downloadTextFile('ord_data_export.json', `${JSON.stringify(output, null, 2)}\n`, 'application/json');
      showToast(toast, 'success', '已匯出最新 JSON。');
    }

    listContainer.addEventListener('click', (event) => {
      const target = event.target.closest('[data-character-id]');
      if (!target) {
        return;
      }

      clearToast(toast);
      setSelectedRecord(target.dataset.characterId);
    });

    listSearchInput.addEventListener('input', renderList);
    materialChips.addEventListener('click', (event) => {
      const target = event.target.closest('[data-remove-material-index]');
      if (!target) {
        return;
      }

      state.materialDraft.splice(Number(target.dataset.removeMaterialIndex), 1);
      renderMaterialDraft();
    });
    clearMaterialsButton.addEventListener('click', () => {
      state.materialDraft = [];
      renderMaterialDraft();
      if (materialPicker) {
        materialPicker.clear(true);
      }
    });
    if (materialPicker) {
      materialPicker.on('change', (value) => {
        if (value) {
          appendMaterial(String(value));
        }
      });
    }
    document.getElementById('saveRecordButton').addEventListener('click', saveCurrentRecord);
    document.getElementById('addRecordButton').addEventListener('click', addRecord);
    document.getElementById('deleteRecordButton').addEventListener('click', deleteRecord);
    document.getElementById('exportJsonButton').addEventListener('click', exportJson);
    document.getElementById('resetToastButton').addEventListener('click', () => clearToast(toast));

    if (state.records.length > 0) {
      state.selectedRecordId = [...state.records].sort(compareRecords)[0].character_id;
    }

    renderSkillTypeCheckboxes();
    syncMaintenancePickers();
    renderList();
    fillForm();
  }

  window.ORDApp.initMaintenancePage = initMaintenancePage;
})();
