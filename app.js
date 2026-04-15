(function () {
  "use strict";

  var STORAGE_KEY = "glass_data_recorder_v1";

  var form = document.getElementById("record-form");
  var input = document.getElementById("record-input");
  var clearBtn = document.getElementById("clear-input");
  var listEl = document.getElementById("record-list");
  var countEl = document.getElementById("record-count");
  var emptyHint = document.getElementById("empty-hint");

  function loadRecords() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveRecords(records) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch (e) {
      alert("保存失败：存储空间可能已满，请删除部分记录后重试。");
    }
  }

  function generateId() {
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function formatTime(isoString) {
    try {
      var d = new Date(isoString);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return "";
    }
  }

  function render() {
    var records = loadRecords();
    listEl.innerHTML = "";

    records.forEach(function (item) {
      var li = document.createElement("li");
      li.className = "record-item";
      li.setAttribute("data-id", item.id);

      var body = document.createElement("div");
      body.className = "record-body";

      var pText = document.createElement("p");
      pText.className = "record-text";
      pText.textContent = item.text;

      var pMeta = document.createElement("p");
      pMeta.className = "record-meta";
      pMeta.textContent = "保存于 " + formatTime(item.createdAt);

      body.appendChild(pText);
      body.appendChild(pMeta);

      var del = document.createElement("button");
      del.type = "button";
      del.className = "btn btn-icon";
      del.setAttribute("aria-label", "删除此条记录");
      del.textContent = "删除";

      del.addEventListener("click", function () {
        removeRecord(item.id);
      });

      li.appendChild(body);
      li.appendChild(del);
      listEl.appendChild(li);
    });

    var n = records.length;
    countEl.textContent = n + " 条";
    if (n === 0) {
      emptyHint.hidden = false;
    } else {
      emptyHint.hidden = true;
    }
  }

  function addRecord(text) {
    var trimmed = text.trim();
    if (!trimmed) return false;

    var records = loadRecords();
    records.unshift({
      id: generateId(),
      text: trimmed,
      createdAt: new Date().toISOString(),
    });
    saveRecords(records);
    return true;
  }

  function removeRecord(id) {
    var records = loadRecords().filter(function (r) {
      return r.id !== id;
    });
    saveRecords(records);
    render();
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (addRecord(input.value)) {
      input.value = "";
      input.focus();
      render();
    }
  });

  clearBtn.addEventListener("click", function () {
    input.value = "";
    input.focus();
  });

  render();
})();
