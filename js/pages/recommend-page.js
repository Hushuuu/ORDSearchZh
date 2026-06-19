(() => {
  const {
    compareRecords,
    createIndices,
    createTomSelectOptions,
    createTomSelectRenderConfig,
    escapeHtml,
    getLevelLabel,
    getPrimaryRecord,
    getMaterialNames,
  } = window.ORDApp;

  function buildTargetLevelOptions(records) {
    const levels = [...new Set(records.map((record) => Number(record.level)).filter((level) => Number.isFinite(level) && level >= 2))]
      .sort((left, right) => left - right);

    return levels.map((level) => ({ value: String(level), label: `${level}｜${getLevelLabel(level)}` }));
  }

  function createInventoryMap(records, lv1Inputs, selectedOwnedIds) {
    const map = new Map();

    records.forEach((record) => {
      map.set(record.character_id, 0);
    });

    lv1Inputs.forEach((record) => {
      const value = Number(record.input.value || 0);
      if (!Number.isFinite(value) || value < 0) {
        record.input.value = '0';
      }
      map.set(record.character_id, Math.max(0, Number(record.input.value || 0)));
    });

    selectedOwnedIds.forEach((characterId) => {
      map.set(characterId, (map.get(characterId) || 0) + 1);
    });

    return map;
  }

  function collectRequiredBaseMaterials(characterId, inventory, indices, counts = new Map(), visited = new Set()) {
    const record = indices.byCharacterId.get(characterId);
    if (!record) {
      return counts;
    }

    if (visited.has(record.character_id)) {
      return counts;
    }

    visited.add(record.character_id);

    const available = inventory.get(record.character_id) || 0;
    if (available > 0) {
      inventory.set(record.character_id, available - 1);
      visited.delete(record.character_id);
      return counts;
    }

    if (record.level <= 1) {
      counts.set(record.character_id, (counts.get(record.character_id) || 0) + 1);
      visited.delete(record.character_id);
      return counts;
    }

    (record.materials || []).forEach((material) => {
      const childRecord = indices.byCharacterId.get(material.material_id);
      if (childRecord) {
        collectRequiredBaseMaterials(childRecord.character_id, inventory, indices, counts, visited);
      } else {
        counts.set(material.material_id, (counts.get(material.material_id) || 0) + 1);
      }
    });

    visited.delete(record.character_id);
    return counts;
  }

  function formatRequiredBaseMaterials(characterId, inventory, indices) {
    const counts = collectRequiredBaseMaterials(characterId, new Map(inventory), indices);
    const segments = [...counts.entries()]
      .sort((left, right) => {
        const leftName = (getPrimaryRecord(left[0], indices)?.name || left[0]).localeCompare((getPrimaryRecord(right[0], indices)?.name || right[0]), 'zh-Hant');
        return leftName || left[0].localeCompare(right[0]);
      })
      .map(([materialId, count]) => `${getPrimaryRecord(materialId, indices)?.name || materialId}*${count}`);

    return segments.join(' + ') || '無需額外素材';
  }

  function initRecommendPage(records) {
    const indices = createIndices(records);
    const targetLevelSelect = document.getElementById('recommendTargetLevel');
    const ownedSelect = document.getElementById('recommendOwnedSelect');
    const lv1Grid = document.getElementById('recommendLv1Grid');
    const resultList = document.getElementById('recommendResultList');
    const summary = document.getElementById('recommendSummary');
    const refreshButton = document.getElementById('recommendRefreshBtn');
    const resetButton = document.getElementById('recommendResetBtn');
    const level1Records = [...records.filter((record) => record.level === 1)].sort(compareRecords);
    const extraRecords = [...records.filter((record) => record.level > 1)].sort(compareRecords);
    const maxLevel = Math.max(...records.map((record) => Number(record.level) || 0), 2);
    const hasTomSelect = typeof window.TomSelect === 'function';
    let dismissedCharacterIds = new Set();
    const ownedSelector = hasTomSelect
      ? new window.TomSelect(ownedSelect, {
          options: [],
          valueField: 'value',
          labelField: 'label',
          searchField: ['label', 'value', 'kr_name', 'en_name'],
          maxOptions: 400,
          create: false,
          persist: false,
          placeholder: '',
          render: createTomSelectRenderConfig(),
          dropdownParent: 'body',
          plugins: ['remove_button'],
        })
      : null;

    function renderLv1Inputs() {
      lv1Grid.innerHTML = level1Records
        .map((record) => `
          <label class="recommend-count-card">
            <span class="recommend-count-label">${escapeHtml(record.name)}</span>
            <input type="number" min="0" step="1" value="0" data-lv1-id="${escapeHtml(record.character_id)}" class="field-input recommend-count-input">
          </label>
        `)
        .join('');
    }

    function buildTargetOptions() {
      targetLevelSelect.innerHTML = buildTargetLevelOptions(records)
        .map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`)
        .join('');
      targetLevelSelect.value = String(Math.min(5, maxLevel));
    }

    function syncOwnedOptions() {
      if (!ownedSelector) {
        return;
      }

      const options = createTomSelectOptions(extraRecords);
      ownedSelector.clear(true);
      ownedSelector.clearOptions();
      ownedSelector.addOptions(options);
      ownedSelector.refreshOptions(false);
    }
    // 固定禁止推薦
    const defaultDismissedIds = ['2-12','4-7','4-46','5-41','6-10','10-1']

    function renderRecommendations() {
      const targetLevel = Number(targetLevelSelect.value || 2);
      const lv1Inputs = Array.from(lv1Grid.querySelectorAll('[data-lv1-id]'))
        .map((input) => ({ character_id: input.dataset.lv1Id, input }));
      const selectedOwnedIds = ownedSelector ? ownedSelector.getValue() : Array.from(ownedSelect.selectedOptions).map((option) => option.value);
      const inventory = createInventoryMap(records, lv1Inputs, selectedOwnedIds);
      const allCandidates = records
        .filter((record) => record.level === targetLevel && !defaultDismissedIds.includes(record.character_id))
        .map((record) => ({ record, requiredText: formatRequiredBaseMaterials(record.character_id, inventory, indices) }))
        .sort((left, right) => {
          const leftCount = collectRequiredBaseMaterials(left.record.character_id, new Map(inventory), indices);
          const rightCount = collectRequiredBaseMaterials(right.record.character_id, new Map(inventory), indices);
          const leftTotal = [...leftCount.values()].reduce((sum, value) => sum + value, 0);
          const rightTotal = [...rightCount.values()].reduce((sum, value) => sum + value, 0);
          return leftTotal - rightTotal || compareRecords(left.record, right.record);
        });
      const candidates = allCandidates.filter(({ record }) => !dismissedCharacterIds.has(record.character_id)).slice(0, 6);

      //summary.textContent = `目標稀有度：${targetLevel}｜${getLevelLabel(targetLevel)}`;

      if (candidates.length === 0) {
        resultList.innerHTML = '<div class="empty-state">此目標稀有度沒有可推薦的角色。</div>';
        return;
      }

      resultList.innerHTML = candidates
        .map(({ record, requiredText }) => `
          <article class="recommend-card">
            <div class="recommend-card-top">
              <span class="badge badge-${record.level}">${escapeHtml(getLevelLabel(record.level))}</span>
              <strong>${escapeHtml(record.name)} ${record.key_code ? `(${escapeHtml(record.key_code)})` : ''}</strong>
              <button type="button" class="secondary recommend-dismiss-btn" data-dismiss-character="${escapeHtml(record.character_id)}" aria-label="隱藏此推薦">×</button>
            </div>
            <div class="recommend-card-meta">材料：${(record.materials || [])
              .map((material) => {
                const childRecord = getPrimaryRecord(material.material_id, indices);
                const label = childRecord ? childRecord.name : material.material_id;
                const levelClass = childRecord ? `badge-${childRecord.level}` : 'badge-0';
                return `<span style="font-size:0.7rem;" class="badge ${levelClass}">${escapeHtml(label)}</span>`;
              })
              .join(' ')}${!(record.materials || []).length ? '<span class="muted">無</span>' : ''}</div>
            <div class="recommend-card-foot">
              <span class="recommend-shortage ${requiredText === '無需額外素材' ? 'is-ready' : ''}">${requiredText === '無需額外素材' ? '可合成' : `需：${escapeHtml(requiredText)}`}</span>
              <span class="muted"></span>
            </div>
          </article>
        `)
        .join('');
    }

    buildTargetOptions();
    renderLv1Inputs();
    syncOwnedOptions();
    renderRecommendations();

    refreshButton.addEventListener('click', () => {
      dismissedCharacterIds = new Set();
      renderRecommendations();
    });
    resetButton.addEventListener('click', () => {
      dismissedCharacterIds = new Set();
      targetLevelSelect.value = String(Math.min(2, maxLevel));
      if (ownedSelector) {
        ownedSelector.clear(true);
      } else {
        Array.from(ownedSelect.options).forEach((option) => {
          option.selected = false;
        });
      }
      lv1Grid.querySelectorAll('[data-lv1-id]').forEach((input) => {
        input.value = '0';
      });
      renderRecommendations();
    });

    targetLevelSelect.addEventListener('change', renderRecommendations);
    lv1Grid.addEventListener('input', renderRecommendations);
    resultList.addEventListener('click', (event) => {
      const button = event.target.closest('[data-dismiss-character]');
      if (!button) {
        return;
      }

      dismissedCharacterIds.add(String(button.dataset.dismissCharacter || ''));
      renderRecommendations();
    });
    if (ownedSelector) {
      ownedSelector.on('change', renderRecommendations);
    } else {
      ownedSelect.addEventListener('change', renderRecommendations);
    }
  }

  window.ORDApp.initRecommendPage = initRecommendPage;
})();
