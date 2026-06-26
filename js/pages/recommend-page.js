(() => {
  const {
    compareRecords,
    createIndices,
    createTomSelectOptions,
    createTomSelectRenderConfig,
    escapeHtml,
    getLevelLabel,
    getPrimaryRecord,
    getSkillTypeLabels,
    createSkillTypeOptions,
  } = window.ORDApp;

  function buildTargetLevelOptions(records) {
    const levels = [...new Set(records.map((record) => Number(record.level)).filter((level) => Number.isFinite(level) && level > 2))]
      .sort((left, right) => left - right);

    return levels.map((level) => ({ value: level, label: `${level}｜${getLevelLabel(level)}` }));
  }

  function countMapTotal(counts) {
    let total = 0;
    counts.forEach((count) => {
      total += count;
    });
    return total;
  }

  function normalizeOwnedValues(value) {
    if (Array.isArray(value)) {
      return value;
    }

    if (value === null || value === undefined || value === '') {
      return [];
    }

    return [value];
  }

  function createInventoryMap(records, ownedCountsByLevel, selectedOwnedIds) {
    const map = new Map();

    records.forEach((record) => {
      map.set(record.character_id, 0);
    });

    [1, 2].forEach((level) => {
      const counts = ownedCountsByLevel[level] || new Map();
      counts.forEach((count, characterId) => {
        map.set(characterId, (map.get(characterId) || 0) + Math.max(0, Number(count) || 0));
      });
    });

    selectedOwnedIds.forEach((characterId) => {
      map.set(characterId, (map.get(characterId) || 0) + 1);
    });

    return map;
  }

  function collectRequiredBaseMaterialsCounts(characterId, inventory, indices, counts = new Map(), visited = new Set()) {
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
        collectRequiredBaseMaterialsCounts(childRecord.character_id, inventory, indices, counts, visited);
      } else {
        counts.set(material.material_id, (counts.get(material.material_id) || 0) + 1);
      }
    });

    visited.delete(record.character_id);
    return counts;
  }

  function formatRequiredBaseMaterialsFromCounts(counts, indices) {
    const segments = [...counts.entries()]
      .filter(([, count]) => count > 0)
      .sort((left, right) => {
        const leftName = (getPrimaryRecord(left[0], indices)?.name || left[0]).localeCompare((getPrimaryRecord(right[0], indices)?.name || right[0]), 'zh-Hant');
        return leftName || left[0].localeCompare(right[0]);
      })
      .map(([materialId, count]) => `${getPrimaryRecord(materialId, indices)?.name || materialId}*${count}`);

    return segments.join(' + ') || '無需額外素材';
  }

  // 以缺口等級分布來評分：先比高 lv 缺了幾個，再比低 lv 缺口。
  function collectMissingTierCountsFromRecord(record, inventory, indices, counts = new Map(), visited = new Set(), isFirstCall = false) {
    if (!record || visited.has(record.character_id)) {
      return counts;
    }

    visited.add(record.character_id);

    const available = inventory.get(record.character_id) || 0;
    if (available > 0) { //背包有這支
      inventory.set(record.character_id, available - 1);
      visited.delete(record.character_id);
      return counts;
    }

    // 無論它是高等級還是低等級，只要背包沒有，就立刻幫它的等級缺口 +1
    if (!isFirstCall){
       counts.set(record.level, (counts.get(record.level) || 0) + 1);
    }

    const materials = record.materials || [];
    if (!materials.length || record.level <= 1) {
      //counts.set(record.level, (counts.get(record.level) || 0) + 1);
      visited.delete(record.character_id);
      return counts;
    }

    materials.forEach((material) => {
      const childRecord = indices.byCharacterId.get(material.material_id);
      if (childRecord) {
        counts = collectMissingTierCountsFromRecord(childRecord, inventory, indices, counts, visited);
      } else {
        //counts.set(record.level, (counts.get(record.level) || 0) + 1);
      }
    });

    visited.delete(record.character_id);
    return counts;
  }
  // 用來快取每隻角色的真實權重（總共相當於多少基礎物資）
  const realWeightCache = new Map();
  function getRealWeight(characterId, indices) {
    if (realWeightCache.has(characterId)) {
      return realWeightCache.get(characterId);
    }
    const record = indices.byCharacterId.get(characterId);
    if (!record) return 1;

    const materials = record.materials || [];
    if (!materials.length || record.level <= 1) {
      realWeightCache.set(characterId, 1);
      return 1;
    }

    let totalWeight = 0;
    materials.forEach((material) => {
      totalWeight += getRealWeight(material.material_id, indices);
    });

    realWeightCache.set(characterId, totalWeight);
    return totalWeight;
  }
  // 分析角色結構，計算「背包有的分數」與「總分數」，用於評估推薦優先度。
  function analyzeStructure(record, inventory, indices,status = { scoreOwned: 0, scoreTotal: 0 }, visited = new Set(), isFirstCall = false) {
    //if (!record || visited.has(record.character_id)) return { scoreOwned: 0, scoreTotal: 0 };
    if (!record || visited.has(record.character_id)) return status;
    visited.add(record.character_id);

    // 1. 如果是第一次呼叫（目標本身），直接在最一開始就算出「真正的總需求分母」！
    if (isFirstCall) {
        status.scoreTotal = getRealWeight(record.character_id, indices);
    }
    // 定義權重：等級越高，權重呈指數型放大（例如 2 的 level 次方）
    //const weight = Math.pow(2.5, record.level);
    const weight = getRealWeight(record.character_id,indices);
    const available = inventory.get(record.character_id) || 0;

    if (available > 0) {
      inventory.set(record.character_id, available - 1);
      status.scoreOwned += weight; // 背包有，拿到這個素材的分數！
      visited.delete(record.character_id);
      return status;
    }
    // 背包沒有，代表這是個缺口，但我們繼續往下看「子材料」幫我們湊了多少完成度
    const materials = record.materials || [];
    if (materials.length && record.level > 1) {
      materials.forEach((material) => {
        const childRecord = indices.byCharacterId.get(material.material_id);
        if (childRecord) {
          //analyzeStructure(childRecord, inventory, indices, status, visited);
          status = analyzeStructure(childRecord, inventory, indices, status, visited, false);
        }
      });
    }

    visited.delete(record.character_id);
    return status;
  }

  function compareMissingTierCounts(leftCounts, rightCounts, levelsDesc) {
    for (const level of levelsDesc) {
      const diff = (leftCounts.get(level) || 0) - (rightCounts.get(level) || 0);
      if (diff !== 0) {
        return diff;
      }
    }

    return 0;
  }

  function renderMaterialPreview(record, inventory, indices) {
    const materials = record.materials || [];
    if (!materials.length) {
      return '<span class="muted">無</span>';
    }

    return materials
      .map((material) => {
        const childRecord = indices.byCharacterId.get(material.material_id);
        const label = childRecord ? childRecord.name : material.material_id;
        const levelClass = childRecord ? `badge-${childRecord.level}` : 'badge-0';
        const owned = childRecord && (inventory.get(childRecord.character_id) || 0) > 0;
        return `
          <span class="recommend-material-chip badge ${levelClass}">
            <span class="recommend-material-chip-label">${escapeHtml(label)}</span>
            ${owned ? '<span class="recommend-owned-mark" aria-label="已擁有">✓</span>' : ''}
          </span>
        `;
      })
      .join('');
  }

  function renderMaterialTree(record, inventory, indices, trail = new Set()) {
    const materials = record.materials || [];
    if (!materials.length) {
      return '';
    }

    return materials
      .map((material) => {
        const childRecord = indices.byCharacterId.get(material.material_id);
        if (!childRecord) {
          return `
            <li>
              <div class="recommend-material-row recommend-material-row--missing">
                <span class="badge badge-0">${escapeHtml(material.material_id)}</span>
                <span class="muted">未找到材料資料</span>
              </div>
            </li>
          `;
        }

        const owned = (inventory.get(childRecord.character_id) || 0) > 0;
        const ownedMark = owned ? '<span class="recommend-owned-mark" aria-label="已擁有">✓</span>' : '';
        const summaryContent = `
          <span class="badge badge-${childRecord.level}">${escapeHtml(getLevelLabel(childRecord.level))}</span>
          <strong class="recommend-material-name">${escapeHtml(childRecord.name)}</strong>
          ${ownedMark}
        `;

        if (childRecord.level > 2 && (childRecord.materials || []).length && !trail.has(childRecord.character_id)) {
          const nextTrail = new Set(trail);
          nextTrail.add(childRecord.character_id);
          return `
            <li>
              <details class="branch-details recommend-material-branch">
                <summary class="branch-summary recommend-material-row">
                  ${summaryContent}
                  <span class="branch-toggle-hint">
                    <img style="vertical-align: middle" width="22" height="22" src="resource/arrow_drop_down.svg" alt="展開">
                  </span>
                </summary>
                <ul class="recommend-material-tree">
                  ${renderMaterialTree(childRecord, inventory, indices, nextTrail)}
                </ul>
              </details>
            </li>
          `;
        }

        return `
          <li>
            <div class="recommend-material-row recommend-material-row--leaf">
              ${summaryContent}
            </div>
          </li>
        `;
      })
      .join('');
  }

  function renderOwnedCountCard(record, count, level) {
    const safeCount = Math.max(0, Number(count) || 0);
    return `
      <article class="recommend-count-card ${safeCount > 0 ? 'is-owned' : ''}" data-owned-card="${escapeHtml(record.character_id)}" data-owned-level="${level}">
        <div class="recommend-count-card-top">
          <span class="recommend-count-label">${escapeHtml(record.name)}</span>
        
        </div>
        <div class="recommend-count-stepper">
          <button type="button" class="recommend-stepper-btn" data-owned-id="${escapeHtml(record.character_id)}" data-owned-delta="-1" aria-label="減少 1">−</button>
          <span class="recommend-count-value">${safeCount}</span>
          <button type="button" class="recommend-stepper-btn" data-owned-id="${escapeHtml(record.character_id)}" data-owned-delta="1" aria-label="增加 1">+</button>
        </div>
      </article>
    `;
  }

  function initRecommendPage(records) {
    const indices = createIndices(records);
    const targetLevelGrid = document.getElementById('recommendTargetLevelGrid');
    const targetSkillGrid = document.getElementById('recommendTargetSkillGrid');
    const ownedSelect = document.getElementById('recommendOwnedSelect');
    const ownedTabs = document.getElementById('recommendOwnedTabs');
    const ownedPanels = document.getElementById('recommendOwnedPanels');
    const resultList = document.getElementById('recommendResultList');
    const summary = document.getElementById('recommendSummary');
    const refreshButton = document.getElementById('recommendRefreshBtn');
    const resetButton = document.getElementById('recommendResetBtn');
    const collapseFilterButton = document.getElementById('collapseFilterBtn');
    const level1Records = [...records.filter((record) => record.level === 1)].sort(compareRecords);
    const level2Records = [...records.filter((record) => record.level === 2)].sort(compareRecords);
    const extraRecords = [...records.filter((record) => record.level > 2)].sort(compareRecords);
    const targetOptions = buildTargetLevelOptions(records);
    const shortagePriorityLevels = [...new Set(records.map((record) => Number(record.level)).filter((level) => Number.isFinite(level) && level >= 0))]
      .sort((left, right) => right - left);
    const hasTomSelect = typeof window.TomSelect === 'function';
    const defaultTargetLevels = new Set([]);
    const ownedCountState = {
      1: new Map(),
      2: new Map(),
    };
    const targetState = {
      activeOwnedLevel: 1,
      selectedTargetLevels: new Set(defaultTargetLevels),
      checkedSkillTypes: new Set(),
    };
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

    function renderTargetLevelCheckboxes() {
      targetLevelGrid.innerHTML = targetOptions
        .map(
          (option) => `
            <label class="checkbox-badge">
              <input type="checkbox" value="${escapeHtml(String(option.value))}" ${targetState.selectedTargetLevels.has(option.value) ? 'checked' : ''}>
              <span class="checkbox-badge-label badge-${option.value}">${escapeHtml(option.label)}</span>
            </label>
          `
        )
        .join('');

      targetLevelGrid.querySelectorAll('input').forEach((input) => {
        input.addEventListener('change', () => {
          const level = Number(input.value);
          if (input.checked) {
            targetState.selectedTargetLevels.add(level);
          } else {
            targetState.selectedTargetLevels.delete(level);
          }
          renderRecommendations();
        });
      });
    }

    function renderOwnedTabs() {
      const tabs = [
        { level: 1, label: `${getLevelLabel(1)}`, count: countMapTotal(ownedCountState[1]) },
        { level: 2, label: `${getLevelLabel(2)}`, count: countMapTotal(ownedCountState[2]) },
      ];

      ownedTabs.innerHTML = tabs
        .map(
          (tab) => `
            <button type="button" class="comp-tree-tab-btn ${targetState.activeOwnedLevel === tab.level ? 'active' : ''}" data-owned-tab="${tab.level}">
              ${escapeHtml(tab.label)}
              <span class="recommend-tab-count">${tab.count}</span>
            </button>
          `
        )
        .join('');
    }

    function renderOwnedPanels() {
      ownedPanels.innerHTML = [
        { level: 1, records: level1Records },
        { level: 2, records: level2Records },
      ]
        .map(({ level, records: levelRecords }) => {
          const isActive = targetState.activeOwnedLevel === level;
          return `
            <div class="recommend-owned-panel ${isActive ? 'active' : 'is-hidden'}" data-owned-panel="${level}">
              <div class="recommend-count-grid">
                ${levelRecords
                  .map((record) => renderOwnedCountCard(record, ownedCountState[level].get(record.character_id) || 0, level))
                  .join('')}
              </div>
              ${levelRecords.length === 0 ? '<div class="empty-state">沒有可用角色。</div>' : ''}
            </div>
          `;
        })
        .join('');
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
    //技能篩選
    function renderSkillTypeCheckboxes() {
      targetSkillGrid.innerHTML = createSkillTypeOptions()
        .map(
          ({ value, label }) => `
            <label class="checkbox-badge">
              <input type="checkbox" value="${escapeHtml(value)}" ${targetState.checkedSkillTypes.has(value) ? 'checked' : ''}>
              <span class="checkbox-badge-label">${escapeHtml(label)}</span>
            </label>
          `
        )
        .join('');

      targetSkillGrid.querySelectorAll('input').forEach((input) => {
        input.addEventListener('change', () => {
          if (input.checked) {
            targetState.checkedSkillTypes.add(input.value);
          } else {
            targetState.checkedSkillTypes.delete(input.value);
          }
          renderRecommendations();
        });
      });
    }

    // 固定禁止推薦
    const defaultDismissedIds = ['2-12', '4-7', '4-46', '5-41', '6-10', '10-1'];

    function renderRecommendations() {
      const selectedTargetLevels = [...targetState.selectedTargetLevels].sort((left, right) => left - right);
      const selectedOwnedIds = ownedSelector
        ? normalizeOwnedValues(ownedSelector.getValue())
        : Array.from(ownedSelect.selectedOptions).map((option) => option.value);
      const inventory = createInventoryMap(records, ownedCountState, selectedOwnedIds);
      const selectedTargetSkillTypes = [...targetState.checkedSkillTypes];

      renderOwnedTabs();
      renderOwnedPanels();

      if (selectedTargetLevels.length === 0) {
        summary.textContent = '請先選擇至少一個目標稀有度。';
        resultList.innerHTML = '<div class="empty-state">請先選擇至少一個目標稀有度。</div>';
        return;
      }

      const resultGroups = selectedTargetLevels
        .map((targetLevel) => {
          const candidates = records
            .filter((record) => record.level === targetLevel 
            && !defaultDismissedIds.includes(record.character_id)
            && (selectedTargetSkillTypes.length === 0 || record.skill_types?.some((skillType) => selectedTargetSkillTypes.includes(skillType))))
            .map((record) => {
              // 1. 計算完成度分數
              const stats = analyzeStructure(record, new Map(inventory), indices, undefined,undefined,true);
              const completionRatio = (stats.scoreTotal > 0 ? (stats.scoreOwned / stats.scoreTotal) : 0).toFixed(7);  
              //console.log(`Analyzed ${record.name} (ID: ${record.character_id}) - Score Owned: ${stats.scoreOwned}, Score Total: ${stats.scoreTotal}, Completion Ratio: ${completionRatio}`);  
              // 2. 計算缺口
              const requiredCounts = collectRequiredBaseMaterialsCounts(record.character_id, new Map(inventory), indices);
              const missingTierCounts = collectMissingTierCountsFromRecord(record, new Map(inventory), indices, undefined, undefined, true);
              return {
                record,
                requiredCounts,
                requiredText: formatRequiredBaseMaterialsFromCounts(requiredCounts, indices),
                missingTierCounts,
                completionRatio,
              };
            })
            .sort((left, right) => {
              // 🌟 排序策略 1：優先推薦「完成度（Ratio）最高」的（從 1.0 降序到 0.0）
              if (right.completionRatio !== left.completionRatio) {
                return right.completionRatio - left.completionRatio;
              }
              // 🌟 排序策略 2：如果完成度一樣，再比對缺口分布（先比高難度缺口）
              const shortageCompare = compareMissingTierCounts(left.missingTierCounts, right.missingTierCounts, shortagePriorityLevels);
              if (shortageCompare !== 0) {
                return shortageCompare;
              }

              return compareRecords(left.record, right.record);
            })
            .filter(({ record }) => !dismissedCharacterIds.has(record.character_id))
            .slice(0, 10);

          return { targetLevel, candidates };
        })
        .filter((group) => group.candidates.length > 0);

      const targetLabelText = selectedTargetLevels.map((level) => `${level}｜${getLevelLabel(level)}`).join('、');
      //summary.textContent = `目標稀有度：${targetLabelText || '未選擇'}｜${resultGroups.reduce((sum, group) => sum + group.candidates.length, 0)} 筆結果`;


      if (resultGroups.length === 0) {
        resultList.innerHTML = '<div class="empty-state">此條件沒有可推薦的角色。</div>';
        return;
      }
      //console.log('resultGroups',resultGroups)
      resultList.innerHTML = resultGroups
        .map(
          (group) => `
            <section class="recommend-result-group">
              <div class="recommend-result-group-head">
                <h3 class="recommend-result-group-title">${escapeHtml(`${group.targetLevel}｜${getLevelLabel(group.targetLevel)}`)}</h3>
                <span style="display: none;" class="recommend-result-group-count">${group.candidates.length}</span>
              </div>
              <div class="recommend-result-group-body">
                ${group.candidates
                  .map(({ record, requiredText, completionRatio }) => `
                    <article class="recommend-card">
                      <div class="card-top-progress-container">
                        <div class="card-top-progress-bar" style="width: ${((completionRatio || 0) * 100).toFixed(2)}%;"></div>
                      </div>
                      <div class="recommend-card-top">
                        <span class="badge badge-${record.level}">${escapeHtml(getLevelLabel(record.level))}</span>
                        <strong>${escapeHtml(record.name)} ${record.key_code ? `(${escapeHtml(record.key_code)})` : ''}</strong>
                        <button type="button" class="secondary recommend-dismiss-btn" data-dismiss-character="${escapeHtml(record.character_id)}" aria-label="隱藏此推薦">×</button>
                      </div>
                      <div>
                        <span>${getSkillTypeLabels(record.skill_types).map((label) => `<span class="badge-skill-type">${escapeHtml(label)}</span>`).join('/')}</span>
                      </div>
                      <details class="branch-details recommend-material-details">
                        <summary class="branch-summary recommend-material-summary">
                          <div class="recommend-material-summary-head">
                            <span class="recommend-material-summary-label">材料</span>
                            <span class="branch-toggle-hint">
                              <img style="vertical-align: middle" width="22" height="22" src="resource/arrow_drop_down.svg" alt="展開">
                            </span>
                          </div>
                          <div class="recommend-material-preview">
                            ${renderMaterialPreview(record, inventory, indices)}
                          </div>
                        </summary>
                        <div class="recommend-material-body">
                          <ul class="recommend-material-tree">
                            ${renderMaterialTree(record, inventory, indices)}
                          </ul>
                        </div>
                      </details>
                      <div class="recommend-card-foot">
                        <span class="recommend-shortage ${requiredText === '無需額外素材' ? 'is-ready' : ''}">${requiredText === '無需額外素材' ? '可合成' : `缺少：${escapeHtml(requiredText)}`}</span>
                        <span class="muted"></span>
                      </div>
                    </article>
                  `)
                  .join('')}
              </div>
            </section>
          `
        )
        .join('');
        //scroll to top
        //resultList.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function setOwnedCardCount(level, characterId, delta) {
      const current = ownedCountState[level].get(characterId) || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        ownedCountState[level].delete(characterId);
      } else {
        ownedCountState[level].set(characterId, next);
      }
      renderRecommendations();
    }

    renderTargetLevelCheckboxes();
    renderSkillTypeCheckboxes();
    renderOwnedTabs();
    renderOwnedPanels();
    syncOwnedOptions();
    renderRecommendations();

    refreshButton.addEventListener('click', () => {
      dismissedCharacterIds = new Set();
      renderRecommendations();
    });

    resetButton.addEventListener('click', () => {
      dismissedCharacterIds = new Set();
      targetState.selectedTargetLevels = new Set();
      targetState.checkedSkillTypes = new Set();
      targetState.activeOwnedLevel = 1;
      ownedCountState[1].clear();
      ownedCountState[2].clear();
      if (ownedSelector) {
        ownedSelector.clear(true);
      } else {
        Array.from(ownedSelect.options).forEach((option) => {
          option.selected = false;
        });
      }
      renderTargetLevelCheckboxes();
      console.log('重置技能篩選');
      renderSkillTypeCheckboxes();
      console.log('重置技能篩選renderSkillTypeCheckboxes');
      renderRecommendations();
      //重置條件區顯示
      const filterSections = document.querySelectorAll('.controls-grid .field-group');
      if (filterSections) {
        filterSections[0].classList.remove('collapsed');
        filterSections[1].classList.remove('collapsed');
        collapseFilterButton.innerText = '收合條件';
      }
    });

    ownedTabs.addEventListener('click', (event) => {
      const button = event.target.closest('[data-owned-tab]');
      if (!button) {
        return;
      }

      targetState.activeOwnedLevel = Number(button.dataset.ownedTab || 1);
      renderRecommendations();
    });

    ownedPanels.addEventListener('click', (event) => {
      const button = event.target.closest('[data-owned-id][data-owned-delta]');
      if (!button) {
        return;
      }

      const level = Number(button.closest('[data-owned-card]')?.dataset.ownedLevel || 1);
      const characterId = String(button.dataset.ownedId || '');
      const delta = Number(button.dataset.ownedDelta || 0);
      if (!characterId || !Number.isFinite(delta)) {
        return;
      }

      setOwnedCardCount(level, characterId, delta);
    });

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

    collapseFilterButton.addEventListener('click', () => {
      const filterSections = document.querySelectorAll('.controls-grid .field-group');
      if (filterSections) {
        filterSections[0].classList.toggle('collapsed');
        filterSections[1].classList.toggle('collapsed');
        collapseFilterButton.innerText = collapseFilterButton.innerText === '收合條件' ? '展開條件' : '收合條件';
      }
    });
  }

  window.ORDApp.initRecommendPage = initRecommendPage;
})();
